import type { RoomEntity } from '../../domain/entities/room.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors/app-error.js';
import type { RoomRepository } from '../../domain/repositories/room-repository.js';
import type { SessionRepository } from '../../domain/repositories/session-repository.js';
import { env } from '../../shared/config/env.js';
import { generateRoomCode } from '../../shared/utils/room-code.js';

export class LobbyService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async createRoom(hostId: string, name: string, maxPlayers?: number): Promise<RoomEntity> {
    const capacity = maxPlayers ?? env.MAX_PLAYERS_PER_ROOM;
    if (capacity < 2 || capacity > env.MAX_PLAYERS_PER_ROOM) {
      throw new ValidationError(`maxPlayers must be between 2 and ${env.MAX_PLAYERS_PER_ROOM}`);
    }

    const existing = await this.rooms.findByPlayerId(hostId);
    if (existing) {
      throw new ConflictError('Already in a room');
    }

    let code = generateRoomCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const collision = await this.rooms.findByCode(code);
      if (!collision) break;
      code = generateRoomCode();
    }

    return this.rooms.create({
      name,
      hostId,
      maxPlayers: capacity,
      code,
    });
  }

  async joinRoom(playerId: string, code: string): Promise<RoomEntity> {
    const existing = await this.rooms.findByPlayerId(playerId);
    if (existing) {
      throw new ConflictError('Already in a room');
    }

    const room = await this.rooms.findByCode(code.toUpperCase());
    if (!room) {
      throw new NotFoundError('Room');
    }

    return this.rooms.addMember(room.id, playerId);
  }

  async leaveRoom(playerId: string): Promise<RoomEntity | null> {
    const room = await this.rooms.findByPlayerId(playerId);
    if (!room) {
      throw new NotFoundError('Room membership');
    }
    return this.rooms.removeMember(room.id, playerId);
  }

  async setReady(playerId: string, ready: boolean): Promise<RoomEntity> {
    const room = await this.rooms.findByPlayerId(playerId);
    if (!room) {
      throw new NotFoundError('Room membership');
    }
    if (room.status !== 'WAITING') {
      throw new ConflictError('Cannot change ready state after game start');
    }
    return this.rooms.setReady(room.id, playerId, ready);
  }

  async getRoom(roomId: string): Promise<RoomEntity> {
    const room = await this.rooms.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room');
    }
    return room;
  }

  async getMyRoom(playerId: string): Promise<RoomEntity | null> {
    return this.rooms.findByPlayerId(playerId);
  }

  async listRooms(): Promise<RoomEntity[]> {
    return this.rooms.listWaiting();
  }

  async startGame(playerId: string): Promise<RoomEntity> {
    const room = await this.rooms.findByPlayerId(playerId);
    if (!room) {
      throw new NotFoundError('Room membership');
    }
    if (room.hostId !== playerId) {
      throw new ForbiddenError('Only the host can start the game');
    }
    if (room.status !== 'WAITING') {
      throw new ConflictError('Room already started');
    }
    if (room.members.length < 1) {
      throw new ValidationError('Need at least one player');
    }
    if (!room.members.every((member) => member.ready || member.playerId === room.hostId)) {
      throw new ValidationError('All non-host players must be ready');
    }

    const updated = await this.rooms.updateStatus(room.id, 'IN_PROGRESS');

    await Promise.all(
      room.members.map((member) =>
        this.sessions.create({
          roomId: room.id,
          playerId: member.playerId,
          metadata: { username: member.username },
        }),
      ),
    );

    return updated;
  }
}
