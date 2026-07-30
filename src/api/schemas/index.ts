import { z } from 'zod';
import { EQUIPMENT_SLOTS } from '../../shared/constants/game.js';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric/underscore'),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createRoomSchema = z.object({
  name: z.string().min(3).max(48),
  maxPlayers: z.number().int().min(2).max(8).optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().min(4).max(8),
});

export const readySchema = z.object({
  ready: z.boolean(),
});

export const addInventorySchema = z.object({
  itemKey: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(999),
  metadata: z.record(z.unknown()).optional(),
});

export const removeInventorySchema = z.object({
  itemKey: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(999),
});

export const equipSchema = z.object({
  slot: z.enum(EQUIPMENT_SLOTS),
  itemKey: z.string().min(1).max(64),
});

export const unequipSchema = z.object({
  slot: z.enum(EQUIPMENT_SLOTS),
});

export const coinTransferSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().min(1).max(128),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
