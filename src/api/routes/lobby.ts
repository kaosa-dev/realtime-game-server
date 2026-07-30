import type { FastifyPluginAsync } from 'fastify';
import type { AppContainer } from '../../shared/container.js';
import { authenticate, requireAuth } from '../middleware/auth.js';
import { createRoomSchema, joinRoomSchema, readySchema } from '../schemas/index.js';

export const lobbyRoutes: FastifyPluginAsync<{ container: AppContainer }> = async (
  app,
  opts,
) => {
  const { lobbyService, gameSessions } = opts.container;

  app.addHook('preHandler', authenticate);

  app.get('/rooms', async () => {
    const rooms = await lobbyService.listRooms();
    return { rooms };
  });

  app.get('/rooms/me', async (request) => {
    const auth = requireAuth(request);
    const room = await lobbyService.getMyRoom(auth.playerId);
    return { room };
  });

  app.post('/rooms', async (request, reply) => {
    const auth = requireAuth(request);
    const body = createRoomSchema.parse(request.body);
    const room = await lobbyService.createRoom(auth.playerId, body.name, body.maxPlayers);
    return reply.status(201).send({ room });
  });

  app.post('/rooms/join', async (request) => {
    const auth = requireAuth(request);
    const body = joinRoomSchema.parse(request.body);
    const room = await lobbyService.joinRoom(auth.playerId, body.code);
    return { room };
  });

  app.post('/rooms/leave', async (request) => {
    const auth = requireAuth(request);
    const room = await lobbyService.leaveRoom(auth.playerId);
    return { room };
  });

  app.post('/rooms/ready', async (request) => {
    const auth = requireAuth(request);
    const body = readySchema.parse(request.body);
    const room = await lobbyService.setReady(auth.playerId, body.ready);
    return { room };
  });

  app.post('/rooms/start', async (request) => {
    const auth = requireAuth(request);
    const room = await lobbyService.startGame(auth.playerId);
    gameSessions.getOrCreate(room.id);
    for (const member of room.members) {
      gameSessions.get(room.id)?.addPlayer(member.playerId, member.username);
    }
    return { room };
  });
};
