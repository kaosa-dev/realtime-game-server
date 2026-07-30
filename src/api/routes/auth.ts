import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { env } from '../../shared/config/env.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { loginSchema, refreshSchema, registerSchema } from '../schemas/index.js';

export const authRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { authService } = opts.container;

  const authLimitConfig = {
    config: {
      rateLimit: {
        max: env.AUTH_RATE_LIMIT_MAX,
        timeWindow: env.AUTH_RATE_LIMIT_WINDOW,
      },
    },
  };

  app.post('/register', authLimitConfig, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body);
    return reply.status(201).send(result);
  });

  app.post('/login', authLimitConfig, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body);
    return reply.send(result);
  });

  app.post('/refresh', authLimitConfig, async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refresh(body.refreshToken);
    return reply.send({ tokens });
  });

  app.post('/logout', { preHandler: authenticate, ...authLimitConfig }, async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const auth = requireAuth(request);
    await authService.logout(auth.userId, body.refreshToken);
    return reply.status(204).send();
  });

  app.post(
    '/logout-all',
    { preHandler: authenticate, ...authLimitConfig },
    async (request, reply) => {
      const auth = requireAuth(request);
      await authService.logoutAll(auth.userId);
      return reply.status(204).send();
    },
  );
};
