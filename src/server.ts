import { disconnectPrisma } from './infrastructure/database/prisma.js';
import { buildApp } from './app.js';
import { env } from './shared/config/env.js';
import { createContainer } from './shared/container.js';

async function main(): Promise<void> {
  const container = createContainer();
  await container.redis.connect();

  const app = await buildApp(container);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    container.gameSessions.destroyAll();
    await container.wsGateway.close();
    await app.close();
    await container.redis.quit();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
  container.wsGateway.attach(app.server);

  app.log.info(`HTTP listening on http://${env.HOST}:${env.PORT}`);
  app.log.info(`WebSocket available at ws://${env.HOST}:${env.PORT}/ws`);
}

main().catch((error) => {
  console.error('Fatal startup error', error);
  process.exit(1);
});
