// src/modules/items/items.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  markItemReturned,
  getUserItems,
} from './items.service.js';
import type { CreateItemInput, UpdateItemInput, ItemFilterInput } from './items.schemas.js';

export const createItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await createItem(req.body as CreateItemInput, req.user!.id);
  res.status(201).json({ data: item });
});

export const getItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getItems(req.query as unknown as ItemFilterInput, req.user?.id);
  res.json(result);
});

export const getItemByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await getItemById(req.params['id']!, req.user?.id);
  res.json({ data: item });
});

export const updateItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await updateItem(
    req.params['id']!,
    req.body as UpdateItemInput,
    req.user!.id,
    req.user!.role,
  );
  res.json({ data: item });
});

export const deleteItemHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteItem(req.params['id']!, req.user!.id, req.user!.role);
  res.status(204).send();
});

export const markReturnedHandler = asyncHandler(async (req: Request, res: Response) => {
  const item = await markItemReturned(req.params['id']!, req.user!.id, req.user!.role);
  res.json({ data: item });
});

export const getUserItemsHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query['page']) || 1;
  const limit = Number(req.query['limit']) || 20;
  const result = await getUserItems(req.user!.id, page, limit);
  res.json(result);
});
