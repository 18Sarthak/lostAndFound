// src/lib/socket.ts
// Socket.io server setup. Initialized once and shared across modules.
import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { prisma } from './prisma.js';

export let io: SocketServer;

/** Bootstrap Socket.io, attach to the HTTP server, configure auth middleware. */
export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    },
    connectionStateRecovery: {},
  });

  // Auth middleware: expect token in handshake auth
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as Record<string, unknown>)['token'] as string | undefined;
      if (!token) return next(new Error('Authentication required'));

      const payload = verifyAccessToken(token);
      // Verify user exists and is not banned
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, isBanned: true, role: true },
      });
      if (!user || user.isBanned) return next(new Error('Unauthorized'));

      (socket as typeof socket & { userId: string; userRole: string }).userId = user.id;
      (socket as typeof socket & { userId: string; userRole: string }).userRole = user.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const typedSocket = socket as typeof socket & { userId: string };
    const userId = typedSocket.userId;

    // Join per-user notification room
    void socket.join(`user:${userId}`);

    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    // Join a claim room — validate the user is a participant
    socket.on('claim:join', async (claimId: unknown) => {
      if (typeof claimId !== 'string') return;
      try {
        const extended = socket as typeof socket & { userId: string; userRole: string };
        const claim = await prisma.claim.findUnique({
          where: { id: claimId },
          include: { item: { select: { userId: true } } },
        });
        if (!claim) return;
        const isParticipant =
          claim.claimantId === extended.userId ||
          claim.item.userId === extended.userId ||
          ['ADMIN', 'MODERATOR'].includes(extended.userRole ?? '');
        if (!isParticipant) return;
        void socket.join(`claim:${claimId}`);
      } catch {
        // Ignore
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

/** Emit an event to a specific user's room (works even if they're offline — won't throw). */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/** Emit to all participants of a claim room. */
export function emitToClaim(claimId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`claim:${claimId}`).emit(event, data);
}
