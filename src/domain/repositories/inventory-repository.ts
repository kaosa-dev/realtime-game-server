import type { InventoryEntity, InventoryItemEntity } from '../entities/inventory.js';

export interface AddItemInput {
  playerId: string;
  itemKey: string;
  name: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface RemoveItemInput {
  playerId: string;
  itemKey: string;
  quantity: number;
}

export interface InventoryRepository {
  ensureForPlayer(playerId: string, capacity?: number): Promise<InventoryEntity>;
  getByPlayerId(playerId: string): Promise<InventoryEntity | null>;
  addItem(input: AddItemInput): Promise<InventoryItemEntity>;
  removeItem(input: RemoveItemInput): Promise<InventoryItemEntity | null>;
}
