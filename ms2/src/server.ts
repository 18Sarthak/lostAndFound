// src/server.ts
import 'dotenv/config';
import http from 'http';
import cron from 'node-cron';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { createApp } from './app.js';
import { initSocket } from './lib/socket.js';
import { expireItemsJob } from './jobs/expireItems.js';
import { matchingSweepJob } from './jobs/matchingSweep.js';
import { cleanupOtpsJob } from './jobs/cleanupOtps.js';

async function main() {
  // Verify DB connection
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();
  const httpServer = http.createServer(app);

  // Bootstrap Socket.io
  initSocket(httpServer);
  logger.info('Socket.io initialised');

  // ── Cron jobs ──────────────────────────────────────────────────────────────
  // Expire items daily at 01:00
  cron.schedule('0 1 * * *', () => {
    logger.info('Running expireItems job');
    void expireItemsJob().catch((err) => logger.error({ err }, 'expireItems job failed'));
  });

  // Matching sweep every hour
  cron.schedule('0 * * * *', () => {
    logger.info('Running matchingSweep job');
    void matchingSweepJob().catch((err) => logger.error({ err }, 'matchingSweep job failed'));
  });

  // Cleanup OTPs daily at 03:00
  cron.schedule('0 3 * * *', () => {
    logger.info('Running cleanupOtps job');
    void cleanupOtpsJob().catch((err) => logger.error({ err }, 'cleanupOtps job failed'));
  });

  // ── Start listening ────────────────────────────────────────────────────────
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📚 API docs at http://localhost:${env.PORT}/docs`);
    logger.info(`❤️  Health at http://localhost:${env.PORT}/health`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully…');
    httpServer.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected. Bye!');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
