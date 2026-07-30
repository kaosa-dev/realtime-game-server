process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/realtime_game_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379/15';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-not-a-placeholder-value-32';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-not-a-placeholder-value-32';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
process.env.GAME_TICK_RATE = process.env.GAME_TICK_RATE ?? '20';
process.env.MAX_PLAYERS_PER_ROOM = process.env.MAX_PLAYERS_PER_ROOM ?? '8';
process.env.MAX_MOVE_SPEED = process.env.MAX_MOVE_SPEED ?? '12';
process.env.HEARTBEAT_INTERVAL_MS = process.env.HEARTBEAT_INTERVAL_MS ?? '5000';
process.env.HEARTBEAT_TIMEOUT_MS = process.env.HEARTBEAT_TIMEOUT_MS ?? '15000';
process.env.WS_RATE_LIMIT_PER_SECOND = process.env.WS_RATE_LIMIT_PER_SECOND ?? '30';
process.env.WS_CONNECT_RATE_LIMIT_PER_MINUTE = process.env.WS_CONNECT_RATE_LIMIT_PER_MINUTE ?? '2000';
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '10';
process.env.HTTP_RATE_LIMIT_MAX = process.env.HTTP_RATE_LIMIT_MAX ?? '300';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX ?? '20';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
process.env.TRUST_PROXY = process.env.TRUST_PROXY ?? 'false';
