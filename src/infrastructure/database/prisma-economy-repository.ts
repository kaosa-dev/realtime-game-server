import type {
  CoinTransactionEntity,
  CreateCoinTransactionInput,
  EconomyRepository,
} from '../../domain/repositories/economy-repository.js';
import { prisma } from './prisma.js';

function mapTx(row: {
  id: string;
  playerId: string;
  amount: number;
  balanceAfter: number;
  type: 'CREDIT' | 'DEBIT';
  reason: string;
  createdAt: Date;
}): CoinTransactionEntity {
  return {
    id: row.id,
    playerId: row.playerId,
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    type: row.type,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export class PrismaEconomyRepository implements EconomyRepository {
  async createTransaction(input: CreateCoinTransactionInput): Promise<CoinTransactionEntity> {
    const tx = await prisma.coinTransaction.create({
      data: {
        playerId: input.playerId,
        amount: input.amount,
        balanceAfter: input.balanceAfter,
        type: input.type,
        reason: input.reason,
      },
    });
    return mapTx(tx);
  }

  async listTransactions(playerId: string, limit = 50): Promise<CoinTransactionEntity[]> {
    const rows = await prisma.coinTransaction.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapTx);
  }
}
