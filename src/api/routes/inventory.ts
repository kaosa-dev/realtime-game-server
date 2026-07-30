import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { removeInventorySchema } from '../schemas/index.js';

export const inventoryRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { inventoryService } = opts.container;

  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const auth = requireAuth(request);
    const inventory = await inventoryService.getInventory(auth.playerId);
    return { inventory };
  });

  app.post('/remove', async (request) => {
    const auth = requireAuth(request);
    const body = removeInventorySchema.parse(request.body);
    const item = await inventoryService.removeItem(auth.playerId, body);
    return { item };
  });
};
