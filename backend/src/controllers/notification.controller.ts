import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PrismaClient } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { ApiError } from '../utils/apiError';

const prisma = new PrismaClient() as any;

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;
  const read = req.query.read as string | undefined;

  const where: any = { recipientId: userId };
  if (read === 'true') where.read = true;
  else if (read === 'false') where.read = false;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { deliveries: true },
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    data: notifications,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  if (!userId) throw new ApiError(401, 'Unauthorized');

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (notification.recipientId !== userId) throw new ApiError(403, 'Forbidden');

  const updated = await notificationService.markAsRead(id);
  res.json({ data: updated });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  await notificationService.markAllAsRead(userId);
  res.json({ data: { success: true } });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  if (!userId) throw new ApiError(401, 'Unauthorized');

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (notification.recipientId !== userId) throw new ApiError(403, 'Forbidden');

  await notificationService.deleteNotification(id);
  res.json({ data: { success: true } });
});

export const getPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const prefs = await notificationService.getPreferences(userId);
  res.json({ data: prefs });
});

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { type, channels, frequency, enabled, quietHoursStart, quietHoursEnd } = req.body;

  if (!userId) throw new ApiError(401, 'Unauthorized');

  if (type && !['water_quality_alert', 'mortality_alert', 'feed_stock_warning', 'harvest_reminder', 'payout_notification', 'task_assignment', 'system_update', 'report_generated', 'auth_otp', 'password_reset'].includes(type)) {
    throw new ApiError(400, 'Invalid notification type');
  }

  if (channels && !Array.isArray(channels)) {
    throw new ApiError(400, 'Channels must be an array');
  }

  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      type: type || undefined,
      channels: channels || undefined,
      frequency: frequency || undefined,
      enabled: enabled !== undefined ? enabled : undefined,
      quietHoursStart: quietHoursStart || undefined,
      quietHoursEnd: quietHoursEnd || undefined,
    },
    create: {
      userId,
      type: type || 'system_update',
      channels: channels || ['in_app'],
      frequency: frequency || 'immediate',
      enabled: enabled !== false,
    },
  });

  res.json({ data: updated });
});

export const testNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { type, channels = ['in_app'] } = req.body;

  if (!userId) throw new ApiError(401, 'Unauthorized');
  if (!type) throw new ApiError(400, 'Notification type is required');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');

  const notification = await notificationService.sendNotification(
    {
      type,
      recipientId: userId,
      title: `Test ${type}`,
      body: `This is a test notification for ${type}`,
      channels: channels as string[],
      priority: 'high',
    },
    {
      userId,
      channels: channels as string[],
      priority: 'high',
    },
  );

  res.status(201).json({ data: notification });
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) throw new ApiError(401, 'Unauthorized');

  const [total, unread, byType, byChannel] = await Promise.all([
    prisma.notification.count({ where: { recipientId: userId } }),
    prisma.notification.count({ where: { recipientId: userId, read: false } }),
    prisma.notification.groupBy({
      by: ['type'],
      where: { recipientId: userId },
      _count: { id: true },
    }),
    prisma.notificationDelivery.groupBy({
      by: ['channel', 'status'],
      where: { notification: { recipientId: userId } },
      _count: { id: true },
    }),
  ]);

  res.json({
    data: {
      total,
      unread,
      byType,
      byChannel,
    },
  });
});
