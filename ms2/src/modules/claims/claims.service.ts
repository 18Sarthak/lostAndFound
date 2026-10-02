// src/modules/claims/claims.service.ts
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { answersMatch, stripHtml } from '../../utils/normalise.js';
import { notify } from '../../lib/notifications.js';
import { emitToClaim, emitToUser } from '../../lib/socket.js';
import { buildMeta, parsePagination } from '../../utils/pagination.js';
import type { SubmitClaimInput, UpdateClaimStatusInput } from './claims.schemas.js';
import type { Role } from '@prisma/client';

const CLAIM_SAFE_SELECT = {
  id: true,
  itemId: true,
  claimantId: true,
  claimant: { select: { id: true, name: true, avatarUrl: true, karmaPoints: true } },
  note: true,
  status: true,
  answerMatches: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function submitClaim(
  itemId: string,
  input: SubmitClaimInput,
  claimantId: string,
) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { type: true, status: true, userId: true, verificationAnswer: true, title: true },
  });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');
  if (item.type !== 'FOUND') throw ApiError.badRequest('Claims can only be made on FOUND items');
  if (item.status !== 'ACTIVE') throw ApiError.conflict('This item is no longer available for claims');
  if (item.userId === claimantId) throw ApiError.conflict('You cannot claim your own item');

  // Check for existing claim from this user
  const existing = await prisma.claim.findUnique({
    where: { itemId_claimantId: { itemId, claimantId } },
  });
  if (existing) {
    if (existing.status === 'CANCELLED') {
      // Allow re-claiming after cancellation
    } else {
      throw ApiError.conflict('You have already submitted a claim for this item');
    }
  }

  // Compare answer server-side
  const isMatch = item.verificationAnswer
    ? answersMatch(input.answer, item.verificationAnswer)
    : true; // no verification question set

  let claim;
  if (existing?.status === 'CANCELLED') {
    claim = await prisma.claim.update({
      where: { id: existing.id },
      data: {
        note: input.note ? stripHtml(input.note) : null,
        answerMatches: isMatch,
        status: 'PENDING',
        decidedAt: null,
      },
      select: CLAIM_SAFE_SELECT,
    });
  } else {
    claim = await prisma.claim.create({
      data: {
        itemId,
        claimantId,
        answer: input.answer,
        note: input.note ? stripHtml(input.note) : null,
        answerMatches: isMatch,
      },
      select: CLAIM_SAFE_SELECT,
    });
  }

  // Notify item owner
  await notify({
    userId: item.userId,
    type: 'CLAIM_RECEIVED',
    title: `New claim on "${item.title}"`,
    body: 'Someone has claimed your found item. Review the claim in your dashboard.',
    link: `/items/${itemId}/claims`,
    sendEmail: true,
  });

  return claim;
}

export async function getItemClaims(
  itemId: string,
  requestingUserId: string,
  role: Role,
  page: number,
  limit: number,
) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { userId: true, status: true },
  });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  const isOwner = item.userId === requestingUserId;
  const isStaff = ['ADMIN', 'MODERATOR'].includes(role);
  if (!isOwner && !isStaff) throw ApiError.forbidden('Only the item owner can view claims');

  const { skip } = parsePagination(page, limit);
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where: { itemId },
      select: CLAIM_SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.claim.count({ where: { itemId } }),
  ]);

  return { data: claims, meta: buildMeta(page, limit, total) };
}

export async function updateClaimStatus(
  claimId: string,
  input: UpdateClaimStatusInput,
  requestingUserId: string,
  role: Role,
) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { item: { select: { userId: true, title: true, id: true, status: true } } },
  });
  if (!claim) throw ApiError.notFound('Claim not found');

  const isOwner = claim.item.userId === requestingUserId;
  const isStaff = ['ADMIN', 'MODERATOR'].includes(role);
  if (!isOwner && !isStaff) throw ApiError.forbidden('Only the item owner can decide on claims');
  if (claim.status !== 'PENDING') throw ApiError.conflict(`Claim is already ${claim.status}`);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.claim.update({
      where: { id: claimId },
      data: { status: input.status, decidedAt: new Date() },
      select: CLAIM_SAFE_SELECT,
    });

    if (input.status === 'APPROVED') {
      // Mark item as CLAIMED
      await tx.item.update({
        where: { id: claim.itemId },
        data: { status: 'CLAIMED' },
      });

      // Auto-reject all other pending claims
      await tx.claim.updateMany({
        where: { itemId: claim.itemId, id: { not: claimId }, status: 'PENDING' },
        data: { status: 'REJECTED', decidedAt: new Date() },
      });

      // Notify claimant
      await tx.notification.create({
        data: {
          userId: claim.claimantId,
          type: 'CLAIM_APPROVED',
          title: `✅ Your claim was approved!`,
          body: `Your claim for "${claim.item.title}" was approved. Contact the finder to arrange pickup.`,
          link: `/claims/${claimId}`,
        },
      });

      // Notify rejected claimants
      const rejectedClaims = await tx.claim.findMany({
        where: { itemId: claim.itemId, status: 'REJECTED', id: { not: claimId } },
        select: { claimantId: true },
      });
      for (const rc of rejectedClaims) {
        await tx.notification.create({
          data: {
            userId: rc.claimantId,
            type: 'CLAIM_REJECTED',
            title: `Your claim was not approved`,
            body: `Another claim for "${claim.item.title}" was approved.`,
            link: `/items/${claim.itemId}`,
          },
        });
      }
    } else {
      // Rejected
      await tx.notification.create({
        data: {
          userId: claim.claimantId,
          type: 'CLAIM_REJECTED',
          title: `Your claim was not approved`,
          body: `Your claim for "${claim.item.title}" was reviewed and not approved.`,
          link: `/items/${claim.itemId}`,
        },
      });
    }

    // Real-time push
    emitToClaim(claimId, 'claim:updated', { claimId, status: updated.status });
    emitToUser(claim.claimantId, 'claim:updated', { claimId, status: updated.status });

    return updated;
  });
}

export async function cancelClaim(claimId: string, requestingUserId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { claimantId: true, status: true },
  });
  if (!claim) throw ApiError.notFound('Claim not found');
  if (claim.claimantId !== requestingUserId) throw ApiError.forbidden('Not your claim');
  if (claim.status !== 'PENDING') throw ApiError.conflict('Only pending claims can be cancelled');

  return prisma.claim.update({
    where: { id: claimId },
    data: { status: 'CANCELLED', decidedAt: new Date() },
    select: CLAIM_SAFE_SELECT,
  });
}

export async function getUserClaims(userId: string, page: number, limit: number) {
  const { skip } = parsePagination(page, limit);
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where: { claimantId: userId },
      select: {
        ...CLAIM_SAFE_SELECT,
        item: {
          select: {
            id: true, title: true, type: true, status: true,
            images: { select: { url: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.claim.count({ where: { claimantId: userId } }),
  ]);
  return { data: claims, meta: buildMeta(page, limit, total) };
}
