// src/modules/items/items.service.ts
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import { parsePagination, buildMeta } from '../../utils/pagination.js';
import { haversineKm, latLngBoundingBox } from '../../utils/geo.js';
import { stripHtml, normaliseText } from '../../utils/normalise.js';
import { extractCloudinaryPublicId, deleteCloudinaryAsset } from '../../lib/cloudinary.js';
import { KARMA_RETURN_REWARD, MAX_ITEM_IMAGES } from '../../config/constants.js';

import type { CreateItemInput, UpdateItemInput, ItemFilterInput } from './items.schemas.js';
import type { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// Fields safe to return for the item owner
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  karmaPoints: true,
  role: true,
} as const;

const ITEM_SELECT_PUBLIC = {
  id: true,
  type: true,
  status: true,
  title: true,
  description: true,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  locationName: true,
  latitude: true,
  longitude: true,
  eventDate: true,
  handoverPointId: true,
  handoverPoint: { select: { id: true, name: true, description: true, latitude: true, longitude: true, openingHours: true } },
  expiresAt: true,
  returnedAt: true,
  userId: true,
  user: { select: SAFE_USER_SELECT },
  images: { select: { id: true, url: true, position: true }, orderBy: { position: 'asc' as const } },
  createdAt: true,
  updatedAt: true,
  // Included in DB query so getItemById can conditionally expose it
  verificationQuestion: true,
} as const;

function validateImages(imageUrls: string[]): { url: string; publicId: string | null }[] {
  if (imageUrls.length > MAX_ITEM_IMAGES) {
    throw ApiError.badRequest(`Maximum ${MAX_ITEM_IMAGES} images allowed`);
  }
  return imageUrls.map((url) => ({
    url,
    publicId: extractCloudinaryPublicId(url),
  }));
}

export async function createItem(input: CreateItemInput, userId: string) {
  // Validate FOUND-item required fields
  if (input.type === 'FOUND') {
    if (!input.verificationQuestion || !input.verificationAnswer) {
      throw ApiError.badRequest('FOUND items require a verification question and answer');
    }
  }

  const images = validateImages(input.imageUrls);

  const status = env.REQUIRE_MODERATION ? 'PENDING_REVIEW' : 'ACTIVE';
  const expiresAt = new Date(Date.now() + env.ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const item = await prisma.item.create({
    data: {
      type: input.type,
      status,
      title: stripHtml(input.title),
      description: stripHtml(input.description),
      categoryId: input.categoryId,
      locationName: input.locationName ? stripHtml(input.locationName) : null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      eventDate: new Date(input.eventDate),
      verificationQuestion: input.verificationQuestion ? stripHtml(input.verificationQuestion) : null,
      verificationAnswer: input.verificationAnswer ? normaliseText(input.verificationAnswer) : null,
      handoverPointId: input.handoverPointId ?? null,
      expiresAt,
      userId,
      images: {
        create: images.map((img, i) => ({
          url: img.url,
          publicId: img.publicId ?? null,
          position: i,
        })),
      },
    },
    select: ITEM_SELECT_PUBLIC,
  });

  // If active, trigger async matching
  if (status === 'ACTIVE') {
    void triggerMatchingForItem(item.id).catch(() => undefined);
  }

  return item;
}

export async function getItems(filters: ItemFilterInput, requestingUserId?: string) {
  const { page, limit, skip } = parsePagination(filters.page, filters.limit);

  const where: Prisma.ItemWhereInput = { status: 'ACTIVE' };

  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.dateFrom || filters.dateTo) {
    where.eventDate = {};
    if (filters.dateFrom) where.eventDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.eventDate.lte = new Date(filters.dateTo);
  }
  if (filters.lat !== undefined && filters.lng !== undefined) {
    const radiusKm = filters.radiusKm ?? env.MATCH_RADIUS_KM;
    const bb = latLngBoundingBox(filters.lat, filters.lng, radiusKm);
    where.latitude = { gte: bb.minLat, lte: bb.maxLat };
    where.longitude = { gte: bb.minLng, lte: bb.maxLng };
  }

  // Full-text search using pg_trgm via raw SQL for the filter; fall back to `contains` on sqlite
  let idFilter: string[] | undefined;
  if (filters.q) {
    const qNorm = filters.q.trim().toLowerCase();
    // Use Prisma raw for trgm similarity search
    try {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Item"
        WHERE status = 'ACTIVE'
          AND (
            similarity(lower(title), ${qNorm}) > 0.1
            OR lower(title) LIKE ${`%${qNorm}%`}
            OR lower(description) LIKE ${`%${qNorm}%`}
          )
        LIMIT 500
      `;
      idFilter = rows.map((r) => r.id);
      if (idFilter.length === 0) {
        return { data: [], meta: buildMeta(page, limit, 0) };
      }
      where.id = { in: idFilter };
    } catch {
      // Fallback if pg_trgm not available
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      select: ITEM_SELECT_PUBLIC,
      orderBy: filters.sort === 'newest' ? { createdAt: 'desc' } : { eventDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  // If geo sort requested, post-filter by actual Haversine distance
  let results = items;
  if (filters.sort === 'nearest' && filters.lat !== undefined && filters.lng !== undefined) {
    const radiusKm = filters.radiusKm ?? env.MATCH_RADIUS_KM;
    results = items
      .filter((item) => {
        if (item.latitude == null || item.longitude == null) return false;
        return haversineKm(filters.lat!, filters.lng!, item.latitude, item.longitude) <= radiusKm;
      })
      .sort((a, b) => {
        const da = haversineKm(filters.lat!, filters.lng!, a.latitude ?? 0, a.longitude ?? 0);
        const db = haversineKm(filters.lat!, filters.lng!, b.latitude ?? 0, b.longitude ?? 0);
        return da - db;
      });
  }

  // Strip verification question from items the requester owns
  const sanitised = results.map((item) => ({
    ...item,
    verificationQuestion:
      requestingUserId && requestingUserId !== item.userId ? item.verificationQuestion ?? null : null,
  }));

  return { data: sanitised, meta: buildMeta(page, limit, total) };
}

export async function getItemById(id: string, requestingUserId?: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      ...ITEM_SELECT_PUBLIC,
      verificationQuestion: true,
    },
  });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  return {
    ...item,
    // Only authenticated non-owners see the verification question
    verificationQuestion:
      requestingUserId && requestingUserId !== item.userId
        ? item.verificationQuestion
        : null,
  };
}

export async function updateItem(id: string, input: UpdateItemInput, userId: string, role: Role) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  if (item.userId !== userId && !['ADMIN', 'MODERATOR'].includes(role)) {
    throw ApiError.forbidden('You do not own this item');
  }
  if (['CLAIMED', 'RETURNED'].includes(item.status)) {
    throw ApiError.conflict('Cannot edit an item in its current status');
  }

  const images = input.imageUrls ? validateImages(input.imageUrls) : undefined;

  return prisma.item.update({
    where: { id },
    data: {
      ...(input.title && { title: stripHtml(input.title) }),
      ...(input.description && { description: stripHtml(input.description) }),
      ...(input.categoryId && { categoryId: input.categoryId }),
      ...(input.locationName !== undefined && { locationName: input.locationName ? stripHtml(input.locationName) : null }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
      ...(input.eventDate && { eventDate: new Date(input.eventDate) }),
      ...(input.verificationQuestion !== undefined && { verificationQuestion: input.verificationQuestion ? stripHtml(input.verificationQuestion) : null }),
      ...(input.handoverPointId !== undefined && { handoverPointId: input.handoverPointId }),
      ...(images && {
        images: {
          deleteMany: {},
          create: images.map((img, i) => ({ url: img.url, publicId: img.publicId, position: i })),
        },
      }),
    },
    select: ITEM_SELECT_PUBLIC,
  });
}

export async function deleteItem(id: string, userId: string, role: Role) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  if (item.userId !== userId && !['ADMIN', 'MODERATOR'].includes(role)) {
    throw ApiError.forbidden('You do not own this item');
  }

  // Soft delete + delete Cloudinary assets async
  await prisma.item.update({ where: { id }, data: { status: 'REMOVED' } });

  // Non-blocking cleanup
  void Promise.all(
    item.images
      .filter((img) => img.publicId)
      .map((img) => deleteCloudinaryAsset(img.publicId!)),
  );
}

export async function markItemReturned(id: string, userId: string, role: Role) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { claims: { where: { status: 'APPROVED' } } },
  });
  if (!item || item.status === 'REMOVED') throw ApiError.notFound('Item not found');

  const isOwner = item.userId === userId;
  const isStaff = ['ADMIN', 'MODERATOR'].includes(role);
  if (!isOwner && !isStaff) throw ApiError.forbidden('Only the item owner can mark it as returned');

  if (item.status === 'RETURNED') throw ApiError.conflict('Item is already marked as returned');
  if (!['CLAIMED', 'ACTIVE'].includes(item.status)) {
    throw ApiError.conflict(`Cannot mark an item with status "${item.status}" as returned`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.item.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        returnVerifiedById: userId,
      },
      select: ITEM_SELECT_PUBLIC,
    });

    // Award karma to the approved claimant (finder/returner)
    const approvedClaim = item.claims[0];
    if (approvedClaim) {
      await tx.user.update({
        where: { id: approvedClaim.claimantId },
        data: { karmaPoints: { increment: KARMA_RETURN_REWARD } },
      });
      await tx.notification.create({
        data: {
          userId: approvedClaim.claimantId,
          type: 'ITEM_RETURNED',
          title: '🎉 Item successfully returned!',
          body: `Thank you! You've been awarded ${KARMA_RETURN_REWARD} karma points for returning "${item.title}".`,
          link: `/items/${item.id}`,
        },
      });
    }
    return updated;
  });
}

export async function getUserItems(userId: string, page: number, limit: number) {
  const { skip } = parsePagination(page, limit);
  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: { userId, status: { not: 'REMOVED' } },
      select: ITEM_SELECT_PUBLIC,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.item.count({ where: { userId, status: { not: 'REMOVED' } } }),
  ]);
  return { data: items, meta: buildMeta(page, limit, total) };
}

// Trigger matching (imported dynamically to avoid circular deps)
async function triggerMatchingForItem(itemId: string): Promise<void> {
  const { runMatchingForItem } = await import('../matches/matches.service.js');
  await runMatchingForItem(itemId);
}
