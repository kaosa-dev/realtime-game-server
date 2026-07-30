import type { Prisma } from '@prisma/client';
import type { Equipment, PlayerProfile } from '../../domain/entities/player.js';
import type {
  CreatePlayerInput,
  PlayerRepository,
} from '../../domain/repositories/player-repository.js';
import { levelFromExperience } from '../../shared/constants/game.js';
import { prisma } from './prisma.js';

function toEquipment(value: unknown): Equipment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Equipment;
}

function mapPlayer(row: {
  id: string;
  userId: string;
  username: string;
  experience: number;
  coins: number;
  level: number;
  equipment: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PlayerProfile {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    experience: row.experience,
    coins: row.coins,
    level: row.level,
    equipment: toEquipment(row.equipment),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPlayerRepository implements PlayerRepository {
  async create(input: CreatePlayerInput): Promise<PlayerProfile> {
    const player = await prisma.player.create({
      data: {
        userId: input.userId,
        username: input.username,
        coins: input.coins ?? 100,
        inventory: {
          create: {},
        },
        leaderboard: {
          create: {
            username: input.username,
            experience: 0,
            level: 1,
          },
        },
      },
    });
    return mapPlayer(player);
  }

  async findById(id: string): Promise<PlayerProfile | null> {
    const player = await prisma.player.findUnique({ where: { id } });
    return player ? mapPlayer(player) : null;
  }

  async findByUserId(userId: string): Promise<PlayerProfile | null> {
    const player = await prisma.player.findUnique({ where: { userId } });
    return player ? mapPlayer(player) : null;
  }

  async findByUsername(username: string): Promise<PlayerProfile | null> {
    const player = await prisma.player.findUnique({ where: { username } });
    return player ? mapPlayer(player) : null;
  }

  async updateCoins(playerId: string, coins: number): Promise<PlayerProfile> {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { coins },
    });
    return mapPlayer(player);
  }

  async addExperience(playerId: string, amount: number): Promise<PlayerProfile> {
    const current = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const experience = current.experience + amount;
    const level = levelFromExperience(experience);

    const player = await prisma.$transaction(async (tx) => {
      const updated = await tx.player.update({
        where: { id: playerId },
        data: { experience, level },
      });
      await tx.leaderboard.upsert({
        where: { playerId },
        create: {
          playerId,
          username: updated.username,
          experience,
          level,
        },
        update: {
          experience,
          level,
          username: updated.username,
        },
      });
      return updated;
    });

    return mapPlayer(player);
  }

  async updateEquipment(playerId: string, equipment: Equipment): Promise<PlayerProfile> {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { equipment: equipment as Prisma.InputJsonValue },
    });
    return mapPlayer(player);
  }
}
