import { NotFoundError, ValidationError } from '../../domain/errors/app-error.js';
import type { CoinTransactionEntity } from '../../domain/repositories/economy-repository.js';
import type { EconomyRepository } from '../../domain/repositories/economy-repository.js';
import type { PlayerRepository } from '../../domain/repositories/player-repository.js';
import { prisma } from '../../infrastructure/database/prisma.js';

export class EconomyService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly economy: EconomyRepository,
  ) {}

  async getBalance(playerId: string): Promise<{ playerId: string; coins: number }> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new NotFoundError('Player');
    }
    return { playerId: player.id, coins: player.coins };
  }

  async credit(
    playerId: string,
    amount: number,
    reason: string,
  ): Promise<{ coins: number; transaction: CoinTransactionEntity }> {
    if (amount <= 0) {
      throw new ValidationError('Credit amount must be positive');
    }

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; coins: number }>>`
        SELECT id, coins FROM players WHERE id = ${playerId} FOR UPDATE
      `;
      const player = locked[0];
      if (!player) {
        throw new NotFoundError('Player');
      }

      const coins = player.coins + amount;
      await tx.player.update({
        where: { id: playerId },
        data: { coins },
      });

      const transaction = await tx.coinTransaction.create({
        data: {
          playerId,
          amount,
          balanceAfter: coins,
          type: 'CREDIT',
          reason,
        },
      });

      return { coins, transaction };
    });

    return {
      coins: result.coins,
      transaction: {
        id: result.transaction.id,
        playerId: result.transaction.playerId,
        amount: result.transaction.amount,
        balanceAfter: result.transaction.balanceAfter,
        type: result.transaction.type,
        reason: result.transaction.reason,
        createdAt: result.transaction.createdAt,
      },
    };
  }

  async debit(
    playerId: string,
    amount: number,
    reason: string,
  ): Promise<{ coins: number; transaction: CoinTransactionEntity }> {
    if (amount <= 0) {
      throw new ValidationError('Debit amount must be positive');
    }

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; coins: number }>>`
        SELECT id, coins FROM players WHERE id = ${playerId} FOR UPDATE
      `;
      const player = locked[0];
      if (!player) {
        throw new NotFoundError('Player');
      }
      if (player.coins < amount) {
        throw new ValidationError('Insufficient coins');
      }

      const coins = player.coins - amount;
      await tx.player.update({
        where: { id: playerId },
        data: { coins },
      });

      const transaction = await tx.coinTransaction.create({
        data: {
          playerId,
          amount,
          balanceAfter: coins,
          type: 'DEBIT',
          reason,
        },
      });

      return { coins, transaction };
    });

    return {
      coins: result.coins,
      transaction: {
        id: result.transaction.id,
        playerId: result.transaction.playerId,
        amount: result.transaction.amount,
        balanceAfter: result.transaction.balanceAfter,
        type: result.transaction.type,
        reason: result.transaction.reason,
        createdAt: result.transaction.createdAt,
      },
    };
  }

  async listTransactions(playerId: string, limit = 50): Promise<CoinTransactionEntity[]> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new NotFoundError('Player');
    }
    return this.economy.listTransactions(playerId, limit);
  }
}
