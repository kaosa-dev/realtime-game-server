import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import type { LobbyService } from '../../application/services/lobby-service.js';
import { UnauthorizedError } from '../../domain/errors/app-error.js';
import { verifyAccessToken } from '../auth/token-service.js';
import type { GameSessionManager } from '../game/game-session-manager.js';
import type { RedisPresenceService, RedisRateLimiter } from '../redis/redis-client.js';
import { env } from '../../shared/config/env.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { ClientMessageSchema } from './protocol.js';

interface SocketContext {
  userId: string;
  playerId: string;
  username: string;
  roomId?: string;
  reconnectToken?: string;
}

interface ReconnectEntry {
  playerId: string;
  roomId: string;
  expiresAt: number;
}

const RECONNECT_TTL_MS = 5 * 60_000;

export class WebSocketGateway {
  private wss: WebSocketServer | null = null;
  private readonly sockets = new Map<WebSocket, SocketContext>();
  private readonly socketsByPlayer = new Map<string, WebSocket>();
  private readonly reconnectTokens = new Map<string, ReconnectEntry>();
  private readonly subscribedRooms = new Set<string>();

  constructor(
    private readonly sessions: GameSessionManager,
    private readonly lobby: LobbyService,
    private readonly presence: RedisPresenceService,
    private readonly rateLimiter: RedisRateLimiter,
  ) {}

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 16_384,
    });

    this.wss.on('connection', (socket, request) => {
      void this.handleConnection(socket, request);
    });
  }

  async close(): Promise<void> {
    for (const socket of this.sockets.keys()) {
      socket.close(1001, 'server_shutdown');
    }
    await new Promise<void>((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close(() => resolve());
    });
  }

  private clientIp(request: IncomingMessage): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0 && env.TRUST_PROXY) {
      return forwarded.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
    }
    return request.socket.remoteAddress || 'unknown';
  }

  private async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      const ipLimit = await this.rateLimiter.consume(`ws-connect:${this.clientIp(request)}`, 30, 60);
      if (!ipLimit.allowed) {
        socket.close(1008, 'connection_rate_limited');
        return;
      }

      const token = this.extractToken(request);
      const payload = verifyAccessToken(token);

      this.replaceExistingSocket(payload.playerId);

      const ctx: SocketContext = {
        userId: payload.userId,
        playerId: payload.playerId,
        username: payload.username,
      };
      this.sockets.set(socket, ctx);
      this.socketsByPlayer.set(payload.playerId, socket);
      await this.presence.setOnline(payload.playerId);

      socket.on('message', (raw) => {
        void this.onMessage(socket, raw.toString());
      });

      socket.on('close', () => {
        void this.onClose(socket);
      });
    } catch {
      this.send(socket, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing access token',
      });
      socket.close(1008, 'unauthorized');
    }
  }

  private replaceExistingSocket(playerId: string): void {
    const existing = this.socketsByPlayer.get(playerId);
    if (!existing) return;
    existing.close(4000, 'replaced_by_new_connection');
    this.sockets.delete(existing);
    this.socketsByPlayer.delete(playerId);
  }

  private extractToken(request: IncomingMessage): string {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }

    // Query token is supported for browser clients but may appear in access logs.
    const url = new URL(request.url ?? '', 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;

    throw new UnauthorizedError('Missing token');
  }

  private purgeExpiredReconnectTokens(now = Date.now()): void {
    for (const [token, entry] of this.reconnectTokens) {
      if (entry.expiresAt <= now) {
        this.reconnectTokens.delete(token);
      }
    }
  }

  private async onMessage(socket: WebSocket, raw: string): Promise<void> {
    const ctx = this.sockets.get(socket);
    if (!ctx) return;

    if (raw.length > 16_384) {
      this.send(socket, { type: 'error', code: 'PAYLOAD_TOO_LARGE', message: 'Message too large' });
      return;
    }

    const limited = await this.rateLimiter.consume(
      `ws:${ctx.playerId}`,
      env.WS_RATE_LIMIT_PER_SECOND,
      1,
    );
    if (!limited.allowed) {
      this.send(socket, {
        type: 'error',
        code: 'RATE_LIMIT',
        message: 'Too many messages',
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.send(socket, { type: 'error', code: 'INVALID_JSON', message: 'Malformed JSON' });
      return;
    }

    const result = ClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.send(socket, {
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid message payload',
      });
      return;
    }

    await this.dispatch(socket, ctx, result.data);
  }

  private async dispatch(
    socket: WebSocket,
    ctx: SocketContext,
    message: ClientMessage,
  ): Promise<void> {
    switch (message.type) {
      case 'join_session':
        await this.joinSession(socket, ctx, message.roomId, message.reconnectToken);
        break;
      case 'input': {
        if (!ctx.roomId) {
          this.send(socket, {
            type: 'error',
            code: 'NOT_IN_SESSION',
            message: 'Join a session first',
          });
          return;
        }
        const session = this.sessions.get(ctx.roomId);
        if (!session) return;
        const accepted = session.enqueueInput(ctx.playerId, {
          seq: message.seq,
          dt: message.dt,
          move: message.move,
          look: message.look,
        });
        if (accepted) {
          this.send(socket, {
            type: 'input_ack',
            seq: message.seq,
            tick: session.getTick(),
          });
        }
        break;
      }
      case 'ping': {
        if (ctx.roomId) {
          const session = this.sessions.get(ctx.roomId);
          const rtt = Math.max(0, Date.now() - message.clientTime);
          session?.updatePing(ctx.playerId, rtt);
        }
        this.send(socket, {
          type: 'pong',
          clientTime: message.clientTime,
          serverTime: Date.now(),
        });
        break;
      }
      case 'heartbeat': {
        if (ctx.roomId) {
          this.sessions.get(ctx.roomId)?.heartbeat(ctx.playerId);
          await this.presence.heartbeat(ctx.playerId, ctx.roomId);
        } else {
          await this.presence.heartbeat(ctx.playerId);
        }
        this.send(socket, { type: 'heartbeat' });
        break;
      }
      case 'request_snapshot': {
        if (!ctx.roomId) return;
        const session = this.sessions.get(ctx.roomId);
        if (!session) return;
        this.send(socket, session.buildFullSnapshot());
        break;
      }
    }
  }

  private async joinSession(
    socket: WebSocket,
    ctx: SocketContext,
    roomId: string,
    reconnectToken?: string,
  ): Promise<void> {
    this.purgeExpiredReconnectTokens();

    if (reconnectToken) {
      const cached = this.reconnectTokens.get(reconnectToken);
      this.reconnectTokens.delete(reconnectToken);
      if (
        !cached ||
        cached.expiresAt <= Date.now() ||
        cached.playerId !== ctx.playerId ||
        cached.roomId !== roomId
      ) {
        this.send(socket, {
          type: 'error',
          code: 'INVALID_RECONNECT',
          message: 'Reconnect token invalid',
        });
        return;
      }
    }

    const room = await this.lobby.getRoom(roomId);
    const isMember = room.members.some((member) => member.playerId === ctx.playerId);
    if (!isMember) {
      this.send(socket, {
        type: 'error',
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      });
      return;
    }

    if (room.status !== 'IN_PROGRESS' && room.status !== 'WAITING') {
      this.send(socket, {
        type: 'error',
        code: 'ROOM_CLOSED',
        message: 'Room is closed',
      });
      return;
    }

    const session = this.sessions.getOrCreate(roomId);
    session.addPlayer(ctx.playerId, ctx.username);

    if (!this.subscribedRooms.has(roomId)) {
      this.subscribedRooms.add(roomId);
      session.on('snapshot', (message) => {
        this.broadcast(roomId, message);
      });
    }

    if (ctx.reconnectToken) {
      this.reconnectTokens.delete(ctx.reconnectToken);
    }

    const token = randomUUID();
    this.reconnectTokens.set(token, {
      playerId: ctx.playerId,
      roomId,
      expiresAt: Date.now() + RECONNECT_TTL_MS,
    });
    ctx.roomId = roomId;
    ctx.reconnectToken = token;

    await this.presence.setOnline(ctx.playerId, roomId);

    this.send(socket, {
      type: 'joined',
      roomId,
      playerId: ctx.playerId,
      tick: session.getTick(),
      reconnectToken: token,
    });
    this.send(socket, session.buildFullSnapshot());
  }

  private async onClose(socket: WebSocket): Promise<void> {
    const ctx = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!ctx) return;

    if (this.socketsByPlayer.get(ctx.playerId) === socket) {
      this.socketsByPlayer.delete(ctx.playerId);
    }

    if (ctx.roomId) {
      this.sessions.get(ctx.roomId)?.markDisconnected(ctx.playerId);
    }
    await this.presence.setOffline(ctx.playerId);
  }

  private broadcast(roomId: string, message: ServerMessage): void {
    for (const [socket, ctx] of this.sockets) {
      if (ctx.roomId === roomId && socket.readyState === socket.OPEN) {
        this.send(socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
