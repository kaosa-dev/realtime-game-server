export const EQUIPMENT_SLOTS = [
  'weapon',
  'helmet',
  'chest',
  'legs',
  'boots',
  'accessory',
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const DEFAULT_PLAYER_HP = 100;
export const DEFAULT_INVENTORY_CAPACITY = 40;
export const DEFAULT_STARTING_COINS = 100;
export const WORLD_BOUNDS = {
  minX: -100,
  maxX: 100,
  minY: 0,
  maxY: 50,
  minZ: -100,
  maxZ: 100,
} as const;

export const XP_PER_LEVEL = 1000;

export function levelFromExperience(experience: number): number {
  return Math.max(1, Math.floor(experience / XP_PER_LEVEL) + 1);
}
