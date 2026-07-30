import { Redis } from 'ioredis';
import { env } from '../../shared/config/env.js';

export type RedisClient = InstanceType<typeof Redis>;

export function createRedisClient(url = env.REDIS_URL): RedisClient {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });
}

export class RedisPresenceService {
  constructor(private readonly redis: RedisClient) {}

  private key(playerId: string): string {
    return `presence:${playerId}`;
  }

  async setOnline(playerId: string, roomId?: string): Promise<void> {
    const payload = JSON.stringify({
      playerId,
      roomId: roomId ?? null,
      lastSeen: Date.now(),
    });
    await this.redis.set(this.key(playerId), payload, 'EX', 60);
  }

  async heartbeat(playerId: string, roomId?: string): Promise<void> {
    await this.setOnline(playerId, roomId);
  }

  async setOffline(playerId: string): Promise<void> {
    await this.redis.del(this.key(playerId));
  }

  async isOnline(playerId: string): Promise<boolean> {
    return (await this.redis.exists(this.key(playerId))) === 1;
  }
}

export class RedisSessionCache {
  constructor(private readonly redis: RedisClient) {}

  private key(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async set(sessionId: string, data: Record<string, unknown>, ttlSeconds = 3600): Promise<void> {
    await this.redis.set(this.key(sessionId), JSON.stringify(data), 'EX', ttlSeconds);
  }

  async get<T extends Record<string, unknown>>(sessionId: string): Promise<T | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }
}

export class RedisRateLimiter {
  constructor(private readonly redis: RedisClient) {}

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  }
}
