// src/modules/messages/messages.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getMessagesHandler, sendMessageHandler, markReadHandler } from './messages.controller.js';

// Mounted at /claims/:claimId/messages
const router = Router({ mergeParams: true });

router.get('/', authenticate, getMessagesHandler);
router.post('/', authenticate, sendMessageHandler);
router.post('/read', authenticate, markReadHandler);

export default router;
