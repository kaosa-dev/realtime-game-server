export type CoinTransactionType = 'CREDIT' | 'DEBIT';

export interface CoinTransactionEntity {
  id: string;
  playerId: string;
  amount: number;
  balanceAfter: number;
  type: CoinTransactionType;
  reason: string;
  createdAt: Date;
}

export interface CreateCoinTransactionInput {
  playerId: string;
  amount: number;
  balanceAfter: number;
  type: CoinTransactionType;
  reason: string;
}

export interface EconomyRepository {
  createTransaction(input: CreateCoinTransactionInput): Promise<CoinTransactionEntity>;
  listTransactions(playerId: string, limit?: number): Promise<CoinTransactionEntity[]>;
}
