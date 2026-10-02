// src/config/constants.ts
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** Per-IP: max OTP requests in the window */
export const OTP_RATE_IP_MAX = 3;
export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
/** Days before expiry to send ITEM_EXPIRING warning */
export const ITEM_EXPIRY_WARNING_DAYS = 3;
export const KARMA_RETURN_REWARD = 10;
export const MAX_ITEM_IMAGES = 5;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const CLAIM_MAX_WRONG_ATTEMPTS = 3;
/** Cloudinary upload folder */
export const CLOUDINARY_FOLDER = 'lostfound/items';
export const CLOUDINARY_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
export const CLOUDINARY_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
