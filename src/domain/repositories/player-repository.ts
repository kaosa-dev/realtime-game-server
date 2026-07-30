import type { Equipment, PlayerProfile } from '../entities/player.js';

export interface CreatePlayerInput {
  userId: string;
  username: string;
  coins?: number;
}

export interface PlayerRepository {
  create(input: CreatePlayerInput): Promise<PlayerProfile>;
  findById(id: string): Promise<PlayerProfile | null>;
  findByUserId(userId: string): Promise<PlayerProfile | null>;
  findByUsername(username: string): Promise<PlayerProfile | null>;
  updateCoins(playerId: string, coins: number): Promise<PlayerProfile>;
  addExperience(playerId: string, amount: number): Promise<PlayerProfile>;
  updateEquipment(playerId: string, equipment: Equipment): Promise<PlayerProfile>;
}
