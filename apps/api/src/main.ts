import { loadConfig, getConfig } from './infrastructure/config/index.js';
import { getLogger } from './infrastructure/logging/logger.js';
import { getPrismaClient, disconnectPrisma } from './infrastructure/database/client.js';
import { disconnectRedis } from './infrastructure/cache/redis.js';
import { closeQueues } from './infrastructure/queue/queues.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  // Load configuration
  loadConfig();
  const config = getConfig();
  const logger = getLogger();

  logger.info('Starting BOOKED API server...');

  try {
    // Initialize database connection
    const prisma = getPrismaClient();
    await prisma.$connect();
    logger.info('Database connected');

    // Build and start the app
    const app = await buildApp();

    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(`Server listening on http://${config.HOST}:${config.PORT}`);
    logger.info(`API documentation available at http://${config.HOST}:${config.PORT}/docs`);

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        logger.info('HTTP server closed');

        await closeQueues();
        logger.info('Job queues closed');

        await disconnectRedis();
        logger.info('Redis disconnected');

        await disconnectPrisma();
        logger.info('Database disconnected');

        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
