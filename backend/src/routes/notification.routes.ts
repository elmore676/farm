import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  testNotification,
  getStats,
} from '../controllers/notification.controller';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const preferencesSchema = z.object({
  body: z.object({
    type: z.string().optional(),
    channels: z.array(z.string()).optional(),
    frequency: z.enum(['immediate', 'daily_digest', 'weekly']).optional(),
    enabled: z.boolean().optional(),
    quietHoursStart: z.string().optional(),
    quietHoursEnd: z.string().optional(),
  }),
});

const testNotificationSchema = z.object({
  body: z.object({
    type: z.string(),
    channels: z.array(z.string()).optional(),
  }),
});

const router = Router();
router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

router.get('/preferences', getPreferences);
router.put('/preferences', validate(preferencesSchema), updatePreferences);

router.post('/test', validate(testNotificationSchema), testNotification);
router.get('/stats', getStats);

export default router;
