import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { equipSchema, unequipSchema } from '../schemas/index.js';

export const playerRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { playerService } = opts.container;

  app.addHook('preHandler', authenticate);

  app.get('/me', async (request) => {
    const auth = requireAuth(request);
    const profile = await playerService.getProfile(auth.playerId);
    return { player: profile };
  });

  app.post('/equip', async (request) => {
    const auth = requireAuth(request);
    const body = equipSchema.parse(request.body);
    const player = await playerService.equipItem(auth.playerId, body.slot, body.itemKey);
    return { player };
  });

  app.post('/unequip', async (request) => {
    const auth = requireAuth(request);
    const body = unequipSchema.parse(request.body);
    const player = await playerService.unequipItem(auth.playerId, body.slot);
    return { player };
  });
};
