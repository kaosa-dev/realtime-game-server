import type { LeaderboardEntry } from '../entities/leaderboard.js';

export interface UpsertLeaderboardInput {
  playerId: string;
  username: string;
  experience: number;
  level: number;
  wins?: number;
}

export interface LeaderboardRepository {
  upsert(input: UpsertLeaderboardInput): Promise<void>;
  getTopByExperience(limit: number): Promise<LeaderboardEntry[]>;
  incrementWins(playerId: string): Promise<void>;
}
