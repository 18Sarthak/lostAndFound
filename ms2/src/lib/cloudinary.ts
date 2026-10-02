// src/lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { CLOUDINARY_FOLDER, CLOUDINARY_ALLOWED_FORMATS, CLOUDINARY_MAX_BYTES } from '../config/constants.js';

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

export interface CloudinarySignParams {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  allowedFormats: string[];
  maxFileSize: number;
}

/** Generate params for a signed browser-to-Cloudinary direct upload. */
export function generateUploadSignature(): CloudinarySignParams {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    folder: CLOUDINARY_FOLDER,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET ?? '',
  );
  return {
    signature,
    timestamp,
    cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: env.CLOUDINARY_API_KEY ?? '',
    folder: CLOUDINARY_FOLDER,
    allowedFormats: CLOUDINARY_ALLOWED_FORMATS,
    maxFileSize: CLOUDINARY_MAX_BYTES,
  };
}

/** Delete a Cloudinary asset by its publicId. Logs errors but does not throw. */
export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Non-fatal — asset may have already been deleted
  }
}

/**
 * Validate that a URL belongs to our Cloudinary account.
 * Returns the extracted publicId or null if invalid.
 */
export function extractCloudinaryPublicId(url: string): string | null {
  if (!env.CLOUDINARY_CLOUD_NAME) return url; // skip validation if cloudinary not configured
  const pattern = new RegExp(
    `^https://res\\.cloudinary\\.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/(?:v\\d+/)?(.+?)(?:\\.[a-z]+)?$`,
    'i',
  );
  const match = pattern.exec(url);
  return match?.[1] ?? null;
}
