import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

export const economyRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { economyService } = opts.container;

  app.addHook('preHandler', authenticate);

  app.get('/balance', async (request) => {
    const auth = requireAuth(request);
    return economyService.getBalance(auth.playerId);
  });

  app.get('/transactions', async (request) => {
    const auth = requireAuth(request);
    const transactions = await economyService.listTransactions(auth.playerId);
    return { transactions };
  });
};
