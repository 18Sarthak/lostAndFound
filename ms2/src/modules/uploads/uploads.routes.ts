// src/modules/uploads/uploads.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { uploadSignLimiter } from '../../middleware/rateLimiters.js';
import { signUploadHandler } from './uploads.controller.js';

const router = Router();

// POST /uploads/sign
router.post('/sign', authenticate, uploadSignLimiter, signUploadHandler);

export default router;
