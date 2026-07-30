import { EventEmitter } from 'node:events';
import type { RuntimePlayerState } from '../../domain/entities/player.js';
import { env } from '../../shared/config/env.js';
import type { MovementInput } from './anti-cheat.js';
import { createRuntimePlayer, validateAndApplyMovement } from './anti-cheat.js';
import { computeDelta, toPlayerSnapshot } from './snapshot.js';
import type {
  DeltaSnapshotMessage,
  FullSnapshotMessage,
  PlayerSnapshot,
} from '../websocket/protocol.js';

export interface GameSessionEvents {
  snapshot: (message: FullSnapshotMessage | DeltaSnapshotMessage) => void;
  playerDisconnected: (playerId: string) => void;
}

export class GameSession extends EventEmitter {
  readonly roomId: string;
  private readonly players = new Map<string, RuntimePlayerState>();
  private readonly previousSnapshots = new Map<string, PlayerSnapshot>();
  private tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private fullSnapshotEvery = 20;
  private readonly pendingInputs = new Map<string, MovementInput[]>();

  constructor(roomId: string) {
    super();
    this.roomId = roomId;
  }

  start(): void {
    if (this.timer) return;
    const intervalMs = 1000 / env.GAME_TICK_RATE;
    this.timer = setInterval(() => this.step(), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getTick(): number {
    return this.tick;
  }

  addPlayer(playerId: string, username: string): RuntimePlayerState {
    const existing = this.players.get(playerId);
    if (existing) {
      existing.connected = true;
      existing.lastHeartbeatAt = Date.now();
      return existing;
    }

    const state = createRuntimePlayer(playerId, username, this.players.size);
    this.players.set(playerId, state);
    this.pendingInputs.set(playerId, []);
    return state;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.pendingInputs.delete(playerId);
    this.previousSnapshots.delete(playerId);
  }

  markDisconnected(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    this.emit('playerDisconnected', playerId);
  }

  enqueueInput(playerId: string, input: MovementInput): boolean {
    const queue = this.pendingInputs.get(playerId);
    if (!queue) return false;
    if (queue.length >= 40) {
      queue.shift();
    }
    queue.push(input);
    return true;
  }

  heartbeat(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.lastHeartbeatAt = Date.now();
    player.connected = true;
  }

  updatePing(playerId: string, ping: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.ping = Math.max(0, Math.round(ping));
  }

  getPlayer(playerId: string): RuntimePlayerState | undefined {
    return this.players.get(playerId);
  }

  getPlayers(): RuntimePlayerState[] {
    return [...this.players.values()];
  }

  buildFullSnapshot(): FullSnapshotMessage {
    return {
      type: 'snapshot',
      tick: this.tick,
      serverTime: Date.now(),
      players: this.getPlayers().map(toPlayerSnapshot),
    };
  }

  private step(): void {
    this.tick += 1;
    const now = Date.now();

    for (const [playerId, state] of this.players) {
      if (now - state.lastHeartbeatAt > env.HEARTBEAT_TIMEOUT_MS) {
        if (state.connected) {
          state.connected = false;
          this.emit('playerDisconnected', playerId);
        }
      }

      const queue = this.pendingInputs.get(playerId) ?? [];
      while (queue.length > 0) {
        const input = queue.shift();
        if (!input) break;
        const result = validateAndApplyMovement(state, input);
        if (result.accepted) {
          this.players.set(playerId, result.state);
        }
      }
    }

    const snapshots = this.getPlayers().map(toPlayerSnapshot);
    const shouldFull = this.tick % this.fullSnapshotEvery === 0 || this.previousSnapshots.size === 0;

    if (shouldFull) {
      const message: FullSnapshotMessage = {
        type: 'snapshot',
        tick: this.tick,
        serverTime: now,
        players: snapshots,
      };
      this.previousSnapshots.clear();
      for (const snapshot of snapshots) {
        this.previousSnapshots.set(snapshot.id, snapshot);
      }
      this.emit('snapshot', message);
      return;
    }

    const { changes, removed } = computeDelta(this.previousSnapshots, snapshots);
    for (const id of removed) {
      this.previousSnapshots.delete(id);
    }
    for (const snapshot of snapshots) {
      this.previousSnapshots.set(snapshot.id, snapshot);
    }

    if (changes.length === 0 && removed.length === 0) {
      return;
    }

    const message: DeltaSnapshotMessage = {
      type: 'delta',
      tick: this.tick,
      serverTime: now,
      baseTick: this.tick - 1,
      changes,
      removed,
    };
    this.emit('snapshot', message);
  }
}
