import type { AuthService } from '../application/services/auth-service.js';
import type { EconomyService } from '../application/services/economy-service.js';
import type { InventoryService } from '../application/services/inventory-service.js';
import type { LeaderboardService } from '../application/services/leaderboard-service.js';
import type { LobbyService } from '../application/services/lobby-service.js';
import type { PlayerService } from '../application/services/player-service.js';
import { AuthService as AuthServiceImpl } from '../application/services/auth-service.js';
import { EconomyService as EconomyServiceImpl } from '../application/services/economy-service.js';
import { InventoryService as InventoryServiceImpl } from '../application/services/inventory-service.js';
import { LeaderboardService as LeaderboardServiceImpl } from '../application/services/leaderboard-service.js';
import { LobbyService as LobbyServiceImpl } from '../application/services/lobby-service.js';
import { PlayerService as PlayerServiceImpl } from '../application/services/player-service.js';
import { PrismaEconomyRepository } from '../infrastructure/database/prisma-economy-repository.js';
import { PrismaInventoryRepository } from '../infrastructure/database/prisma-inventory-repository.js';
import { PrismaLeaderboardRepository } from '../infrastructure/database/prisma-leaderboard-repository.js';
import { PrismaPlayerRepository } from '../infrastructure/database/prisma-player-repository.js';
import { PrismaRefreshTokenRepository } from '../infrastructure/database/prisma-refresh-token-repository.js';
import { PrismaRoomRepository } from '../infrastructure/database/prisma-room-repository.js';
import { PrismaSessionRepository } from '../infrastructure/database/prisma-session-repository.js';
import { PrismaUserRepository } from '../infrastructure/database/prisma-user-repository.js';
import { GameSessionManager } from '../infrastructure/game/game-session-manager.js';
import {
  createRedisClient,
  type RedisClient,
  RedisPresenceService,
  RedisRateLimiter,
  RedisSessionCache,
} from '../infrastructure/redis/redis-client.js';
import { WebSocketGateway } from '../infrastructure/websocket/gateway.js';

export interface AppContainer {
  redis: RedisClient;
  authService: AuthService;
  playerService: PlayerService;
  inventoryService: InventoryService;
  economyService: EconomyService;
  lobbyService: LobbyService;
  leaderboardService: LeaderboardService;
  gameSessions: GameSessionManager;
  presence: RedisPresenceService;
  sessionCache: RedisSessionCache;
  rateLimiter: RedisRateLimiter;
  wsGateway: WebSocketGateway;
}

export function createContainer(): AppContainer {
  const redis = createRedisClient();
  const users = new PrismaUserRepository();
  const players = new PrismaPlayerRepository();
  const refreshTokens = new PrismaRefreshTokenRepository();
  const inventories = new PrismaInventoryRepository();
  const economy = new PrismaEconomyRepository();
  const rooms = new PrismaRoomRepository();
  const sessions = new PrismaSessionRepository();
  const leaderboard = new PrismaLeaderboardRepository();

  const authService = new AuthServiceImpl(users, players, refreshTokens);
  const playerService = new PlayerServiceImpl(players, inventories);
  const inventoryService = new InventoryServiceImpl(inventories);
  const economyService = new EconomyServiceImpl(players, economy);
  const lobbyService = new LobbyServiceImpl(rooms, sessions);
  const leaderboardService = new LeaderboardServiceImpl(leaderboard);

  const gameSessions = new GameSessionManager();
  const presence = new RedisPresenceService(redis);
  const sessionCache = new RedisSessionCache(redis);
  const rateLimiter = new RedisRateLimiter(redis);
  const wsGateway = new WebSocketGateway(gameSessions, lobbyService, presence, rateLimiter);

  return {
    redis,
    authService,
    playerService,
    inventoryService,
    economyService,
    lobbyService,
    leaderboardService,
    gameSessions,
    presence,
    sessionCache,
    rateLimiter,
    wsGateway,
  };
}
