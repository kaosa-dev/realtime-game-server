import type { Prisma } from '@prisma/client';
import type { InventoryEntity, InventoryItemEntity } from '../../domain/entities/inventory.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/app-error.js';
import type {
  AddItemInput,
  InventoryRepository,
  RemoveItemInput,
} from '../../domain/repositories/inventory-repository.js';
import { DEFAULT_INVENTORY_CAPACITY } from '../../shared/constants/game.js';
import { prisma } from './prisma.js';

function toMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapItem(row: {
  id: string;
  inventoryId: string;
  itemKey: string;
  name: string;
  quantity: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): InventoryItemEntity {
  return {
    id: row.id,
    inventoryId: row.inventoryId,
    itemKey: row.itemKey,
    name: row.name,
    quantity: row.quantity,
    metadata: toMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaInventoryRepository implements InventoryRepository {
  async ensureForPlayer(
    playerId: string,
    capacity = DEFAULT_INVENTORY_CAPACITY,
  ): Promise<InventoryEntity> {
    const inventory = await prisma.inventory.upsert({
      where: { playerId },
      create: { playerId, capacity },
      update: {},
      include: { items: true },
    });

    return {
      id: inventory.id,
      playerId: inventory.playerId,
      capacity: inventory.capacity,
      items: inventory.items.map(mapItem),
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    };
  }

  async getByPlayerId(playerId: string): Promise<InventoryEntity | null> {
    const inventory = await prisma.inventory.findUnique({
      where: { playerId },
      include: { items: true },
    });
    if (!inventory) return null;

    return {
      id: inventory.id,
      playerId: inventory.playerId,
      capacity: inventory.capacity,
      items: inventory.items.map(mapItem),
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    };
  }

  async addItem(input: AddItemInput): Promise<InventoryItemEntity> {
    if (input.quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { playerId: input.playerId },
        include: { items: true },
      });
      if (!inventory) {
        throw new NotFoundError('Inventory');
      }

      const existing = inventory.items.find((item) => item.itemKey === input.itemKey);
      if (!existing && inventory.items.length >= inventory.capacity) {
        throw new ConflictError('Inventory is full');
      }

      if (existing) {
        const updated = await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + input.quantity },
        });
        return mapItem(updated);
      }

      const created = await tx.inventoryItem.create({
        data: {
          inventoryId: inventory.id,
          itemKey: input.itemKey,
          name: input.name,
          quantity: input.quantity,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return mapItem(created);
    });
  }

  async removeItem(input: RemoveItemInput): Promise<InventoryItemEntity | null> {
    if (input.quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }

    return prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { playerId: input.playerId },
        include: { items: true },
      });
      if (!inventory) {
        throw new NotFoundError('Inventory');
      }

      const existing = inventory.items.find((item) => item.itemKey === input.itemKey);
      if (!existing) {
        throw new NotFoundError('Inventory item');
      }
      if (existing.quantity < input.quantity) {
        throw new ValidationError('Insufficient item quantity');
      }

      if (existing.quantity === input.quantity) {
        await tx.inventoryItem.delete({ where: { id: existing.id } });
        return null;
      }

      const updated = await tx.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity - input.quantity },
      });
      return mapItem(updated);
    });
  }
}
