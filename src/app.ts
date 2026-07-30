import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { AppContainer } from './shared/container.js';
import { env } from './shared/config/env.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { authRoutes } from './api/routes/auth.js';
import { adminRoutes } from './api/routes/admin.js';
import { economyRoutes } from './api/routes/economy.js';
import { inventoryRoutes } from './api/routes/inventory.js';
import { leaderboardRoutes } from './api/routes/leaderboard.js';
import { lobbyRoutes } from './api/routes/lobby.js';
import { playerRoutes } from './api/routes/player.js';

export async function buildApp(container: AppContainer) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss' },
            }
          : undefined,
    },
  });

  app.setErrorHandler(errorHandler);

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: env.HTTP_RATE_LIMIT_MAX,
    timeWindow: env.HTTP_RATE_LIMIT_WINDOW,
    redis: container.redis,
    allowList: (request) => {
      const url = request.url.split('?')[0];
      return url === '/health' || url === '/ready';
    },
  });

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    try {
      const pong = await container.redis.ping();
      if (pong !== 'PONG') {
        return reply.status(503).send({ status: 'not_ready', redis: false });
      }
      return { status: 'ready', redis: true };
    } catch {
      return reply.status(503).send({ status: 'not_ready', redis: false });
    }
  });

  await app.register(authRoutes, { prefix: '/auth', container });
  await app.register(playerRoutes, { prefix: '/players', container });
  await app.register(inventoryRoutes, { prefix: '/inventory', container });
  await app.register(economyRoutes, { prefix: '/economy', container });
  await app.register(lobbyRoutes, { prefix: '/lobby', container });
  await app.register(leaderboardRoutes, { prefix: '/leaderboard', container });
  await app.register(adminRoutes, { prefix: '/admin', container });

  return app;
}
