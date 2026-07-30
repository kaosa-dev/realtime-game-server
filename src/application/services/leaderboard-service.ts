import type { LeaderboardEntry } from '../../domain/entities/leaderboard.js';
import type { LeaderboardRepository } from '../../domain/repositories/leaderboard-repository.js';

export class LeaderboardService {
  constructor(private readonly leaderboard: LeaderboardRepository) {}

  async getTopPlayers(limit = 10): Promise<LeaderboardEntry[]> {
    const capped = Math.min(Math.max(limit, 1), 100);
    return this.leaderboard.getTopByExperience(capped);
  }
}
