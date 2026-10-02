// src/modules/claims/claims.schemas.ts
import { z } from 'zod';

export const SubmitClaimSchema = z.object({
  answer: z.string().min(1).max(500).trim(),
  note: z.string().max(1000).trim().optional(),
});

export const UpdateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const ClaimIdSchema = z.object({ claimId: z.string().uuid() });
export const ItemClaimsParamsSchema = z.object({ id: z.string().uuid() });

export type SubmitClaimInput = z.infer<typeof SubmitClaimSchema>;
export type UpdateClaimStatusInput = z.infer<typeof UpdateClaimStatusSchema>;
