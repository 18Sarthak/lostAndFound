// src/modules/uploads/uploads.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { generateUploadSignature } from '../../lib/cloudinary.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';

export const signUploadHandler = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw ApiError.internal('Cloudinary is not configured on this server');
  }
  const params = generateUploadSignature();
  res.json({ data: params });
});
