import { z } from 'zod';

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join_session'),
    roomId: z.string().uuid(),
    reconnectToken: z.string().optional(),
  }),
  z.object({
    type: z.literal('input'),
    seq: z.number().int().nonnegative(),
    dt: z.number().positive().max(0.25),
    move: z.object({
      x: z.number().min(-1).max(1),
      y: z.number().min(-1).max(1),
      z: z.number().min(-1).max(1),
    }),
    look: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
  }),
  z.object({
    type: z.literal('ping'),
    clientTime: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('heartbeat'),
  }),
  z.object({
    type: z.literal('request_snapshot'),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface PlayerSnapshot {
  id: string;
  username: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  hp: number;
  connected: boolean;
  ping: number;
  lastProcessedInputSeq: number;
}

export interface FullSnapshotMessage {
  type: 'snapshot';
  tick: number;
  serverTime: number;
  players: PlayerSnapshot[];
}

export interface DeltaSnapshotMessage {
  type: 'delta';
  tick: number;
  serverTime: number;
  baseTick: number;
  changes: Array<Partial<PlayerSnapshot> & { id: string }>;
  removed: string[];
}

export interface PongMessage {
  type: 'pong';
  clientTime: number;
  serverTime: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface JoinedMessage {
  type: 'joined';
  roomId: string;
  playerId: string;
  tick: number;
  reconnectToken: string;
}

export interface TickAckMessage {
  type: 'input_ack';
  seq: number;
  tick: number;
}

export type ServerMessage =
  | FullSnapshotMessage
  | DeltaSnapshotMessage
  | PongMessage
  | ErrorMessage
  | JoinedMessage
  | TickAckMessage
  | { type: 'heartbeat' };
