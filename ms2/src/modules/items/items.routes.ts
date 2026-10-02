// src/modules/items/items.routes.ts
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import {
  CreateItemSchema,
  UpdateItemSchema,
  ItemFilterSchema,
  ItemIdSchema,
} from './items.schemas.js';
import {
  createItemHandler,
  getItemsHandler,
  getItemByIdHandler,
  updateItemHandler,
  deleteItemHandler,
  markReturnedHandler,
} from './items.controller.js';

const router = Router();

// GET /items — public listing with filters
router.get('/', optionalAuth, validate({ query: ItemFilterSchema }), getItemsHandler);

// POST /items — create (authenticated)
router.post('/', authenticate, validate({ body: CreateItemSchema }), createItemHandler);

// GET /items/:id — public detail
router.get('/:id', optionalAuth, validate({ params: ItemIdSchema }), getItemByIdHandler);

// PATCH /items/:id — update (owner or admin)
router.patch(
  '/:id',
  authenticate,
  validate({ params: ItemIdSchema, body: UpdateItemSchema }),
  updateItemHandler,
);

// DELETE /items/:id — soft delete (owner or admin)
router.delete('/:id', authenticate, validate({ params: ItemIdSchema }), deleteItemHandler);

// POST /items/:id/mark-returned
router.post(
  '/:id/mark-returned',
  authenticate,
  validate({ params: ItemIdSchema }),
  markReturnedHandler,
);

export default router;
