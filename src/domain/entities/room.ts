export type RoomStatus = 'WAITING' | 'IN_PROGRESS' | 'CLOSED';

export interface RoomMemberEntity {
  id: string;
  roomId: string;
  playerId: string;
  username: string;
  ready: boolean;
  joinedAt: Date;
}

export interface RoomEntity {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  members: RoomMemberEntity[];
  createdAt: Date;
  updatedAt: Date;
}
