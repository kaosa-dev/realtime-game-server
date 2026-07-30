import { z } from 'zod';
import 'dotenv/config';

const WEAK_SECRET_MARKERS = ['change-me', 'dev-access', 'dev-refresh', 'production-access', 'production-refresh'];

function rejectWeakSecret(secret: string, name: string, nodeEnv: string): string {
  if (nodeEnv === 'production') {
    const lower = secret.toLowerCase();
    if (WEAK_SECRET_MARKERS.some((marker) => lower.includes(marker))) {
      throw new Error(`${name} looks like a placeholder and is not allowed in production`);
    }
  }
  return secret;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    GAME_TICK_RATE: z.coerce.number().int().positive().default(20),
    MAX_PLAYERS_PER_ROOM: z.coerce.number().int().positive().default(8),
    MAX_MOVE_SPEED: z.coerce.number().positive().default(12),
    HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
    HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    WS_RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(30),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    HTTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    HTTP_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
    ADMIN_API_KEY: z.string().min(16).optional(),
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
    TRUST_PROXY: z
      .union([z.literal('true'), z.literal('false'), z.coerce.boolean()])
      .default(false)
      .transform((value) => value === true || value === 'true'),
  })
  .superRefine((value, ctx) => {
    try {
      rejectWeakSecret(value.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', value.NODE_ENV);
      rejectWeakSecret(value.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', value.NODE_ENV);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Invalid JWT secret',
      });
    }

    if (value.NODE_ENV === 'production' && value.ADMIN_API_KEY) {
      const lower = value.ADMIN_API_KEY.toLowerCase();
      if (lower.includes('change-me') || lower.includes('dev-admin')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ADMIN_API_KEY looks like a placeholder and is not allowed in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export function parseCorsOrigins(raw = env.CORS_ORIGINS): boolean | string[] {
  const trimmed = raw.trim();
  if (trimmed === '*') {
    return env.NODE_ENV === 'production' ? [] : true;
  }
  return trimmed
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
