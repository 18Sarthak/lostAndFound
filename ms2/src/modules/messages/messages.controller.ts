// src/modules/messages/messages.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMessages, sendMessage, markMessagesRead } from './messages.service.js';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError.js';

const SendMsgSchema = z.object({ body: z.string().min(1).max(2000).trim() });

export const getMessagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMessages(
    req.params['claimId']!,
    req.user!.id,
    req.user!.role,
    Number(req.query['page']) || 1,
    Number(req.query['limit']) || 50,
  );
  res.json(result);
});

export const sendMessageHandler = asyncHandler(async (req: Request, res: Response) => {
  const parsed = SendMsgSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Invalid message body', parsed.error.errors);
  const result = await sendMessage(
    req.params['claimId']!,
    parsed.data.body,
    req.user!.id,
    req.user!.role,
  );
  res.status(201).json({ data: result });
});

export const markReadHandler = asyncHandler(async (req: Request, res: Response) => {
  await markMessagesRead(req.params['claimId']!, req.user!.id, req.user!.role);
  res.json({ data: { message: 'Messages marked as read' } });
});
