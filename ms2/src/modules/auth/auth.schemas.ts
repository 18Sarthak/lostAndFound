// src/modules/auth/auth.schemas.ts
import { z } from 'zod';

export const RequestOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
  name: z.string().min(2).max(100).optional(),
});

export const RefreshSchema = z.object({});

export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
