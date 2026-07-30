import type { Equipment, PlayerProfile } from '../../domain/entities/player.js';
import { setEquipmentSlot } from '../../domain/entities/player.js';
import { NotFoundError, ValidationError } from '../../domain/errors/app-error.js';
import type { InventoryRepository } from '../../domain/repositories/inventory-repository.js';
import type { PlayerRepository } from '../../domain/repositories/player-repository.js';
import type { EquipmentSlot } from '../../shared/constants/game.js';
import { EQUIPMENT_SLOTS } from '../../shared/constants/game.js';

export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly inventories: InventoryRepository,
  ) {}

  async getProfile(playerId: string): Promise<PlayerProfile> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new NotFoundError('Player');
    }
    return player;
  }

  async getProfileByUserId(userId: string): Promise<PlayerProfile> {
    const player = await this.players.findByUserId(userId);
    if (!player) {
      throw new NotFoundError('Player');
    }
    return player;
  }

  async equipItem(playerId: string, slot: EquipmentSlot, itemKey: string): Promise<PlayerProfile> {
    if (!EQUIPMENT_SLOTS.includes(slot)) {
      throw new ValidationError('Invalid equipment slot');
    }

    const inventory = await this.inventories.getByPlayerId(playerId);
    if (!inventory) {
      throw new NotFoundError('Inventory');
    }

    const item = inventory.items.find((entry) => entry.itemKey === itemKey);
    if (!item) {
      throw new NotFoundError('Inventory item');
    }

    const player = await this.getProfile(playerId);
    const equipment = setEquipmentSlot(player.equipment, slot, itemKey);
    return this.players.updateEquipment(playerId, equipment);
  }

  async unequipItem(playerId: string, slot: EquipmentSlot): Promise<PlayerProfile> {
    if (!EQUIPMENT_SLOTS.includes(slot)) {
      throw new ValidationError('Invalid equipment slot');
    }

    const player = await this.getProfile(playerId);
    const equipment: Equipment = setEquipmentSlot(player.equipment, slot, undefined);
    return this.players.updateEquipment(playerId, equipment);
  }

  async addExperience(playerId: string, amount: number): Promise<PlayerProfile> {
    if (amount <= 0) {
      throw new ValidationError('Experience amount must be positive');
    }
    return this.players.addExperience(playerId, amount);
  }
}
