import type { Prisma } from '@prisma/client';
import type {
  CreateSessionInput,
  SessionEntity,
  SessionRepository,
  SessionStatus,
} from '../../domain/repositories/session-repository.js';
import { prisma } from './prisma.js';

function toMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapSession(row: {
  id: string;
  roomId: string;
  playerId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  metadata: unknown;
}): SessionEntity {
  return {
    id: row.id,
    roomId: row.roomId,
    playerId: row.playerId,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    metadata: toMetadata(row.metadata),
  };
}

export class PrismaSessionRepository implements SessionRepository {
  async create(input: CreateSessionInput): Promise<SessionEntity> {
    const session = await prisma.session.create({
      data: {
        roomId: input.roomId,
        playerId: input.playerId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return mapSession(session);
  }

  async updateStatus(
    id: string,
    status: SessionStatus,
    endedAt?: Date,
  ): Promise<SessionEntity> {
    const session = await prisma.session.update({
      where: { id },
      data: {
        status,
        ...(endedAt ? { endedAt } : {}),
      },
    });
    return mapSession(session);
  }

  async findActiveByRoom(roomId: string): Promise<SessionEntity[]> {
    const sessions = await prisma.session.findMany({
      where: { roomId, status: { in: ['ACTIVE', 'DISCONNECTED'] } },
    });
    return sessions.map(mapSession);
  }

  async endAllForRoom(roomId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { roomId, status: { in: ['ACTIVE', 'DISCONNECTED'] } },
      data: { status: 'ENDED', endedAt: new Date() },
    });
  }
}
