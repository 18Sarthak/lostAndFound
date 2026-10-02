// src/modules/notifications/notifications.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  getNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
  unreadCountHandler,
} from './notifications.controller.js';

const router = Router();

router.get('/', authenticate, getNotificationsHandler);
router.get('/unread-count', authenticate, unreadCountHandler);
router.patch('/:id/read', authenticate, markReadHandler);
router.post('/read-all', authenticate, markAllReadHandler);

export default router;
