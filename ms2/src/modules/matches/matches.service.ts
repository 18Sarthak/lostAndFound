import { prisma } from '../../lib/prisma.js';
import { haversineKm } from '../../utils/geo.js';
import { env } from '../../config/env.js';
import { notify } from '../../lib/notifications.js';
import { buildMeta, parsePagination } from '../../utils/pagination.js';

// ── MatchStrategy interface ───────────────────────────────────────────────────
export interface MatchCandidate {
  id: string;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  eventDate: Date;
  categoryId: number;
}

export interface MatchStrategy {
  score(lost: MatchCandidate, found: MatchCandidate): Promise<number>;
}

// ── Rules-based scorer ────────────────────────────────────────────────────────
class RulesBasedMatcher implements MatchStrategy {
  async score(lost: MatchCandidate, found: MatchCandidate): Promise<number> {
    // Text similarity via Jaccard on trigrams (simple JS implementation)
    const textScore = jaccardTrigram(
      `${lost.title} ${lost.description}`,
      `${found.title} ${found.description}`,
    );

    // Date proximity (0..1 based on days apart within window)
    const daysDiff =
      Math.abs(lost.eventDate.getTime() - found.eventDate.getTime()) / (1000 * 60 * 60 * 24);
    const dateScore = Math.max(0, 1 - daysDiff / env.MATCH_DAYS_WINDOW);

    // Geo score (0..1 based on distance within radius)
    let geoScore = 0;
    if (
      lost.latitude != null &&
      lost.longitude != null &&
      found.latitude != null &&
      found.longitude != null
    ) {
      const distKm = haversineKm(lost.latitude, lost.longitude, found.latitude, found.longitude);
      geoScore = Math.max(0, 1 - distKm / env.MATCH_RADIUS_KM);
    } else {
      // If either has no location, give neutral score
      geoScore = 0.5;
    }

    // Category must match (hard filter applied before scoring)
    // Weighted average: text 50%, geo 30%, date 20%
    return textScore * 0.5 + geoScore * 0.3 + dateScore * 0.2;
  }
}

function jaccardTrigram(a: string, b: string): number {
  const trigramsA = trigrams(a.toLowerCase());
  const trigramsB = new Set(trigrams(b.toLowerCase()));
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(s: string): Set<string> {
  const result = new Set<string>();
  const clean = s.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i <= clean.length - 3; i++) {
    result.add(clean.slice(i, i + 3));
  }
  return result;
}

// Singleton strategy — swap out for embedding strategy later
const matcher: MatchStrategy = new RulesBasedMatcher();

// ── Core matching logic ───────────────────────────────────────────────────────
export async function runMatchingForItem(itemId: string): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true, type: true, status: true, categoryId: true,
      title: true, description: true,
      latitude: true, longitude: true, eventDate: true, userId: true,
    },
  });
  if (!item || item.status !== 'ACTIVE') return;

  const oppositeType = item.type === 'LOST' ? 'FOUND' : 'LOST';
  const windowStart = new Date(
    item.eventDate.getTime() - env.MATCH_DAYS_WINDOW * 24 * 60 * 60 * 1000,
  );
  const windowEnd = new Date(
    item.eventDate.getTime() + env.MATCH_DAYS_WINDOW * 24 * 60 * 60 * 1000,
  );

  // Fetch candidates: same category, opposite type, within date window, ACTIVE
  const candidates = await prisma.item.findMany({
    where: {
      type: oppositeType,
      status: 'ACTIVE',
      categoryId: item.categoryId,
      eventDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true, title: true, description: true,
      latitude: true, longitude: true, eventDate: true, userId: true,
    },
  });

  const itemCandidate: MatchCandidate = {
    id: item.id,
    title: item.title,
    description: item.description,
    latitude: item.latitude,
    longitude: item.longitude,
    eventDate: item.eventDate,
    categoryId: item.categoryId,
  };

  for (const candidate of candidates) {
    const candidateMatch: MatchCandidate = {
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      eventDate: candidate.eventDate,
      categoryId: item.categoryId,
    };

    const lostCandidate = item.type === 'LOST' ? itemCandidate : candidateMatch;
    const foundCandidate = item.type === 'FOUND' ? itemCandidate : candidateMatch;
    const score = await matcher.score(lostCandidate, foundCandidate);

    if (score < env.MATCH_MIN_SCORE) continue;

    // Upsert match record
    const match = await prisma.match.upsert({
      where: {
        lostItemId_foundItemId: {
          lostItemId: lostCandidate.id,
          foundItemId: foundCandidate.id,
        },
      },
      create: {
        lostItemId: lostCandidate.id,
        foundItemId: foundCandidate.id,
        score,
      },
      update: { score },
    });

    if (!match.notified) {
      // Notify both item owners
      const lostItem = item.type === 'LOST' ? item : candidate;
      const foundItem = item.type === 'FOUND' ? item : candidate;

      await Promise.all([
        notify({
          userId: lostItem.userId,
          type: 'MATCH_FOUND',
          title: '🔍 Potential match found!',
          body: `A found item may match your lost "${lostItem.title}". Check it out!`,
          link: `/items/${lostItem.id}/matches`,
          sendEmail: false,
        }),
        notify({
          userId: foundItem.userId,
          type: 'MATCH_FOUND',
          title: '🔍 Potential match found!',
          body: `Your found "${foundItem.title}" may match someone's lost item.`,
          link: `/items/${foundItem.id}/matches`,
          sendEmail: false,
        }),
      ]);

      await prisma.match.update({ where: { id: match.id }, data: { notified: true } });
    }
  }
}

export async function getItemMatches(
  itemId: string,
  requestingUserId: string,
  page: number,
  limit: number,
) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { userId: true, type: true, status: true },
  });
  if (!item || item.status === 'REMOVED') {
    const { ApiError: Err } = await import('../../utils/ApiError.js');
    throw Err.notFound('Item not found');
  }
  if (item.userId !== requestingUserId) {
    const { ApiError: Err } = await import('../../utils/ApiError.js');
    throw Err.forbidden('Only the item owner can view matches');
  }

  const { skip } = parsePagination(page, limit);
  const matchWhere =
    item.type === 'LOST' ? { lostItemId: itemId } : { foundItemId: itemId };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where: { ...matchWhere, dismissed: false },
      include: {
        lostItem: { select: { id: true, title: true, type: true, images: { select: { url: true }, take: 1 } } },
        foundItem: { select: { id: true, title: true, type: true, images: { select: { url: true }, take: 1 } } },
      },
      orderBy: { score: 'desc' },
      skip,
      take: limit,
    }),
    prisma.match.count({ where: { ...matchWhere, dismissed: false } }),
  ]);

  return { data: matches, meta: buildMeta(page, limit, total) };
}

export async function dismissMatch(matchId: string, requestingUserId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      lostItem: { select: { userId: true } },
      foundItem: { select: { userId: true } },
    },
  });
  if (!match) {
    const { ApiError: Err } = await import('../../utils/ApiError.js');
    throw Err.notFound('Match not found');
  }
  const isOwner =
    match.lostItem.userId === requestingUserId ||
    match.foundItem.userId === requestingUserId;
  if (!isOwner) {
    const { ApiError: Err } = await import('../../utils/ApiError.js');
    throw Err.forbidden('Not your match');
  }
  return prisma.match.update({
    where: { id: matchId },
    data: { dismissed: true },
  });
}
