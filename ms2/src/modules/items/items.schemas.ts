// src/modules/items/items.schemas.ts
import { z } from 'zod';

export const CreateItemSchema = z.object({
  type: z.enum(['LOST', 'FOUND']),
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(10).max(2000).trim(),
  categoryId: z.coerce.number().int().positive(),
  eventDate: z
    .string()
    .datetime({ offset: true })
    .refine((d) => new Date(d) <= new Date(), { message: 'Event date cannot be in the future' }),
  locationName: z.string().max(200).trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  imageUrls: z.array(z.string().url()).max(5).default([]),
  // FOUND-only fields
  verificationQuestion: z.string().min(5).max(500).trim().optional(),
  verificationAnswer: z.string().min(1).max(500).trim().optional(),
  handoverPointId: z.string().uuid().optional(),
});

export const UpdateItemSchema = CreateItemSchema.partial().omit({
  type: true,
  verificationAnswer: true, // not patchable via API
});

export const ItemFilterSchema = z.object({
  type: z.enum(['LOST', 'FOUND']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().max(200).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  sort: z.enum(['newest', 'nearest']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ItemIdSchema = z.object({ id: z.string().uuid() });

export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type ItemFilterInput = z.infer<typeof ItemFilterSchema>;
