// src/utils/normalise.ts
/** Normalise a string for comparison: trim, lowercase, collapse whitespace. */
export function normaliseText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Strip HTML tags from user-supplied text to prevent XSS in DB. */
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

/** Check if two answers match after normalisation. */
export function answersMatch(a: string, b: string): boolean {
  return normaliseText(a) === normaliseText(b);
}
