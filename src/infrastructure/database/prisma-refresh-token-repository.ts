import type {
  CreateRefreshTokenInput,
  RefreshTokenEntity,
  RefreshTokenRepository,
} from '../../domain/repositories/refresh-token-repository.js';
import { prisma } from './prisma.js';

function mapToken(row: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}): RefreshTokenEntity {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    const token = await prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return mapToken(token);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    return token ? mapToken(token) : null;
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeIfActive(id: string): Promise<boolean> {
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
