// src/lib/notifications.ts
// Central helper to persist a notification, push it over Socket.io, and optionally email.
import { prisma } from './prisma.js';
import { emitToUser } from './socket.js';
import type { NotificationType } from '@prisma/client';

interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  /** If true and RESEND_API_KEY is set, also sends an email */
  sendEmail?: boolean;
}

export async function notify(opts: NotifyOptions): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
    },
  });

  // Real-time push (no-op if user is offline)
  emitToUser(opts.userId, 'notification:new', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  });

  // Optional email notification (best-effort, non-blocking)
  if (opts.sendEmail) {
    void sendEmailNotification(opts.userId, opts.title, opts.body ?? '', opts.link ?? undefined);
  }
}

async function sendEmailNotification(
  userId: string,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;
    const { mailer, notificationEmailHtml } = await import('./mailer.js');
    await mailer.send({
      to: user.email,
      subject: title,
      html: notificationEmailHtml(title, body, link),
    });
  } catch {
    // Non-fatal — notification already persisted
  }
}
