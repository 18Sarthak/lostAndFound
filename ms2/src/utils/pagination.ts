// src/utils/pagination.ts
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../config/constants.js';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(
  rawPage: unknown,
  rawLimit: unknown,
): PaginationParams {
  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(rawLimit) || DEFAULT_PAGE_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(page: number, limit: number, total: number): PaginatedMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
