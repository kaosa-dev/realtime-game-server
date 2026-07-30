import type { RoomEntity, RoomStatus } from '../entities/room.js';

export interface CreateRoomInput {
  name: string;
  hostId: string;
  maxPlayers: number;
  code: string;
}

export interface RoomRepository {
  create(input: CreateRoomInput): Promise<RoomEntity>;
  findById(id: string): Promise<RoomEntity | null>;
  findByCode(code: string): Promise<RoomEntity | null>;
  findByPlayerId(playerId: string): Promise<RoomEntity | null>;
  addMember(roomId: string, playerId: string): Promise<RoomEntity>;
  removeMember(roomId: string, playerId: string): Promise<RoomEntity | null>;
  setReady(roomId: string, playerId: string, ready: boolean): Promise<RoomEntity>;
  updateStatus(roomId: string, status: RoomStatus): Promise<RoomEntity>;
  listWaiting(limit?: number): Promise<RoomEntity[]>;
}
