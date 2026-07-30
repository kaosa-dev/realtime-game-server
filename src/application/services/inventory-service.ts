import type { InventoryEntity, InventoryItemEntity } from '../../domain/entities/inventory.js';
import { NotFoundError } from '../../domain/errors/app-error.js';
import type { InventoryRepository } from '../../domain/repositories/inventory-repository.js';

export class InventoryService {
  constructor(private readonly inventories: InventoryRepository) {}

  async getInventory(playerId: string): Promise<InventoryEntity> {
    const inventory = await this.inventories.getByPlayerId(playerId);
    if (!inventory) {
      return this.inventories.ensureForPlayer(playerId);
    }
    return inventory;
  }

  async addItem(
    playerId: string,
    input: { itemKey: string; name: string; quantity: number; metadata?: Record<string, unknown> },
  ): Promise<InventoryItemEntity> {
    await this.getInventory(playerId);
    return this.inventories.addItem({
      playerId,
      itemKey: input.itemKey,
      name: input.name,
      quantity: input.quantity,
      metadata: input.metadata,
    });
  }

  async removeItem(
    playerId: string,
    input: { itemKey: string; quantity: number },
  ): Promise<InventoryItemEntity | null> {
    const inventory = await this.inventories.getByPlayerId(playerId);
    if (!inventory) {
      throw new NotFoundError('Inventory');
    }
    return this.inventories.removeItem({
      playerId,
      itemKey: input.itemKey,
      quantity: input.quantity,
    });
  }
}
