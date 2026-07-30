export interface InventoryItemEntity {
  id: string;
  inventoryId: string;
  itemKey: string;
  name: string;
  quantity: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryEntity {
  id: string;
  playerId: string;
  capacity: number;
  items: InventoryItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}
