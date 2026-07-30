import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { loginSchema, refreshSchema, registerSchema } from '../schemas/index.js';

export const authRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { authService } = opts.container;

  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body);
    return reply.status(201).send(result);
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body);
    return reply.send(result);
  });

  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await authService.refresh(body.refreshToken);
    return reply.send({ tokens });
  });

  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    requireAuth(request);
    await authService.logout(body.refreshToken);
    return reply.status(204).send();
  });
};
