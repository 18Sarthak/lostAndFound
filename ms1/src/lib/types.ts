// Shared TypeScript types matching the backend Prisma schema

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  karmaPoints: number;
  isBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  karmaPoints: number;
  role?: string;
}

export type ItemType = "LOST" | "FOUND";
export type ItemStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "CLAIMED"
  | "RETURNED"
  | "EXPIRED"
  | "REMOVED";
export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type NotificationType =
  | "MATCH_FOUND"
  | "CLAIM_RECEIVED"
  | "CLAIM_APPROVED"
  | "CLAIM_REJECTED"
  | "NEW_MESSAGE"
  | "ITEM_RETURNED"
  | "ITEM_EXPIRING"
  | "SYSTEM";

export interface ItemImage {
  id: string;
  url: string;
  position: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

export interface HandoverPoint {
  id: string;
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  isActive: boolean;
}

export interface Item {
  id: string;
  type: ItemType;
  status: ItemStatus;
  title: string;
  description: string;
  categoryId: number;
  category: Category;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  eventDate: string;
  verificationQuestion: string | null;
  handoverPointId: string | null;
  handoverPoint: HandoverPoint | null;
  expiresAt: string | null;
  returnedAt: string | null;
  userId: string;
  user: PublicUser;
  images: ItemImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  itemId: string;
  claimantId: string;
  note: string | null;
  status: ClaimStatus;
  answerMatches: boolean | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  claimId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Match {
  id: string;
  lostItemId: string;
  foundItemId: string;
  score: number;
  notified: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description: string;
  categoryId: number;
  eventDate: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  imageUrls?: string[];
  verificationQuestion?: string;
  verificationAnswer?: string;
  handoverPointId?: string;
}
