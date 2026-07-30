export type SessionStatus = 'ACTIVE' | 'DISCONNECTED' | 'ENDED';

export interface SessionEntity {
  id: string;
  roomId: string;
  playerId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface CreateSessionInput {
  roomId: string;
  playerId: string;
  metadata?: Record<string, unknown>;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionEntity>;
  updateStatus(id: string, status: SessionStatus, endedAt?: Date): Promise<SessionEntity>;
  findActiveByRoom(roomId: string): Promise<SessionEntity[]>;
  endAllForRoom(roomId: string): Promise<void>;
}
