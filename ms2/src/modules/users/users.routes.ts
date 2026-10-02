// src/modules/users/users.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getUserItemsHandler, getUserClaimsHandler } from './users.controller.js';

const router = Router();

// GET /users/me/items
router.get('/me/items', authenticate, getUserItemsHandler);

// GET /users/me/claims
router.get('/me/claims', authenticate, getUserClaimsHandler);

export default router;
