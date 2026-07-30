import type { LeaderboardEntry } from '../../domain/entities/leaderboard.js';
import type {
  LeaderboardRepository,
  UpsertLeaderboardInput,
} from '../../domain/repositories/leaderboard-repository.js';
import { prisma } from './prisma.js';

export class PrismaLeaderboardRepository implements LeaderboardRepository {
  async upsert(input: UpsertLeaderboardInput): Promise<void> {
    await prisma.leaderboard.upsert({
      where: { playerId: input.playerId },
      create: {
        playerId: input.playerId,
        username: input.username,
        experience: input.experience,
        level: input.level,
        wins: input.wins ?? 0,
      },
      update: {
        username: input.username,
        experience: input.experience,
        level: input.level,
        ...(input.wins !== undefined ? { wins: input.wins } : {}),
      },
    });
  }

  async getTopByExperience(limit: number): Promise<LeaderboardEntry[]> {
    const rows = await prisma.leaderboard.findMany({
      orderBy: [{ experience: 'desc' }, { wins: 'desc' }],
      take: limit,
    });

    return rows.map((row, index) => ({
      playerId: row.playerId,
      username: row.username,
      experience: row.experience,
      level: row.level,
      wins: row.wins,
      rank: index + 1,
    }));
  }

  async incrementWins(playerId: string): Promise<void> {
    await prisma.leaderboard.update({
      where: { playerId },
      data: { wins: { increment: 1 } },
    });
  }
}
