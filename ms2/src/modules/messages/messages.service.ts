// src/modules/messages/messages.service.ts
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { stripHtml } from '../../utils/normalise.js';
import { checkForContactInfo } from '../../utils/contactMask.js';
import { emitToClaim } from '../../lib/socket.js';
import { notify } from '../../lib/notifications.js';
import { buildMeta, parsePagination } from '../../utils/pagination.js';
import type { Role } from '@prisma/client';

const MSG_SELECT = {
  id: true,
  claimId: true,
  senderId: true,
  sender: { select: { id: true, name: true, avatarUrl: true } },
  body: true,
  readAt: true,
  createdAt: true,
} as const;

async function assertClaimAccess(
  claimId: string,
  userId: string,
  role: Role,
): Promise<{ claimantId: string; ownerId: string; itemTitle: string }> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { item: { select: { userId: true, title: true, status: true } } },
  });
  if (!claim) throw ApiError.notFound('Claim not found');

  const isParticipant =
    claim.claimantId === userId ||
    claim.item.userId === userId ||
    ['ADMIN', 'MODERATOR'].includes(role);
  if (!isParticipant) throw ApiError.forbidden('Access denied');

  return {
    claimantId: claim.claimantId,
    ownerId: claim.item.userId,
    itemTitle: claim.item.title,
  };
}

export async function getMessages(
  claimId: string,
  userId: string,
  role: Role,
  page: number,
  limit: number,
) {
  await assertClaimAccess(claimId, userId, role);
  const { skip } = parsePagination(page, limit);
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { claimId },
      select: MSG_SELECT,
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { claimId } }),
  ]);
  return { data: messages, meta: buildMeta(page, limit, total) };
}

export async function sendMessage(
  claimId: string,
  body: string,
  senderId: string,
  role: Role,
) {
  const { claimantId, ownerId, itemTitle } = await assertClaimAccess(claimId, senderId, role);
  const cleaned = stripHtml(body).trim();
  if (!cleaned) throw ApiError.badRequest('Message cannot be empty');

  const { warning } = checkForContactInfo(cleaned);

  const message = await prisma.message.create({
    data: { claimId, senderId, body: cleaned },
    select: MSG_SELECT,
  });

  // Emit to claim room (real-time)
  emitToClaim(claimId, 'message:new', { message, warning });

  // Notify the other party
  const recipientId = senderId === ownerId ? claimantId : ownerId;
  await notify({
    userId: recipientId,
    type: 'NEW_MESSAGE',
    title: `New message about "${itemTitle}"`,
    body: cleaned.slice(0, 100),
    link: `/claims/${claimId}`,
  });

  return { message, warning };
}

export async function markMessagesRead(claimId: string, userId: string, role: Role) {
  await assertClaimAccess(claimId, userId, role);
  await prisma.message.updateMany({
    where: { claimId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}
