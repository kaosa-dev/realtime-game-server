import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { leaderboardQuerySchema } from '../schemas/index.js';

export const leaderboardRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { leaderboardService } = opts.container;

  app.get('/', async (request) => {
    const query = leaderboardQuerySchema.parse(request.query);
    const entries = await leaderboardService.getTopPlayers(query.limit);
    return { entries };
  });
};
