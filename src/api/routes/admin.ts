import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { requireAdmin } from '../middleware/admin.js';
import { addInventorySchema, coinTransferSchema } from '../schemas/index.js';

const adminPlayerTargetSchema = z.object({
  playerId: z.string().uuid(),
});

export const adminRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (app, opts) => {
  const { inventoryService, economyService } = opts.container;

  app.addHook('preHandler', requireAdmin);

  app.post('/inventory/grant', async (request, reply) => {
    const target = adminPlayerTargetSchema.parse(request.body);
    const body = addInventorySchema.parse(request.body);
    const item = await inventoryService.addItem(target.playerId, body);
    return reply.status(201).send({ item });
  });

  app.post('/economy/credit', async (request) => {
    const target = adminPlayerTargetSchema.parse(request.body);
    const body = coinTransferSchema.parse(request.body);
    return economyService.credit(target.playerId, body.amount, body.reason);
  });

  app.post('/economy/debit', async (request) => {
    const target = adminPlayerTargetSchema.parse(request.body);
    const body = coinTransferSchema.parse(request.body);
    return economyService.debit(target.playerId, body.amount, body.reason);
  });
};
