import type { EquipmentSlot } from '../../shared/constants/game.js';
import type { Vec3 } from '../value-objects/vec3.js';

export interface Equipment {
  weapon?: string;
  helmet?: string;
  chest?: string;
  legs?: string;
  boots?: string;
  accessory?: string;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  username: string;
  experience: number;
  coins: number;
  level: number;
  equipment: Equipment;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuntimePlayerState {
  id: string;
  username: string;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
  hp: number;
  connected: boolean;
  ping: number;
  lastProcessedInputSeq: number;
  lastHeartbeatAt: number;
}

export function emptyEquipment(): Equipment {
  return {};
}

export function setEquipmentSlot(
  equipment: Equipment,
  slot: EquipmentSlot,
  itemKey: string | undefined,
): Equipment {
  const next = { ...equipment };
  if (itemKey === undefined) {
    delete next[slot];
  } else {
    next[slot] = itemKey;
  }
  return next;
}
