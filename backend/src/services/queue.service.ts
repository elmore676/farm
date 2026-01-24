import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { emailService, smsService, pushService, webhookService } from './delivery.service';
import { notificationService, TemplateEngine } from './notification.service';

const prisma = new PrismaClient() as any;
const templateEngine = new TemplateEngine();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: null,
} as any;

const QUEUE_NAME = 'notifications';
const NOTIFICATION_QUEUE_CONFIG = {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

export const notificationQueue = new Queue(QUEUE_NAME, NOTIFICATION_QUEUE_CONFIG);

interface NotificationJobData {
  notificationId: string;
  userId: string;
  channel: any;
  templateVariables?: Record<string, any>;
  [key: string]: any;
}

export const notificationWorker = new Worker(QUEUE_NAME, async (job) => {
  const data = job.data as NotificationJobData;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: data.notificationId },
      include: { recipient: true },
    });

    if (!notification) {
      throw new Error(`Notification ${data.notificationId} not found`);
    }

    const user = notification.recipient;
    const channel = data.channel as any;

    let delivery;
    let result: { success: boolean; error?: string; messageId?: string };

    switch (channel) {
      case 'email':
        result = await deliverEmail(notification, user.email, data);
        break;
      case 'sms':
        result = await deliverSMS(notification, user, data);
        break;
      case 'push':
        result = await deliverPush(notification, user.id, data);
        break;
      case 'webhook':
        result = await deliverWebhook(notification, data);
        break;
      case 'in_app':
        result = { success: true };
        break;
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }

    delivery = await prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: channel as any,
        status: result.success ? 'delivered' : 'failed',
        sentAt: new Date(),
        deliveredAt: result.success ? new Date() : null,
        failedAt: !result.success ? new Date() : null,
        failureReason: result.error,
        externalId: result.messageId,
      },
    });

    return { delivered: true, deliveryId: delivery.id };
  } catch (error) {
    console.error(`Notification job failed (attempt ${job.attemptsMade}):`, error);
    throw error;
  }
}, NOTIFICATION_QUEUE_CONFIG);

notificationWorker.on('failed', async (job, err) => {
  if (job) {
    const data = job.data as NotificationJobData;
    await prisma.notificationDelivery.create({
      data: {
        notificationId: data.notificationId,
        channel: data.channel as any,
        status: 'failed',
        failedAt: new Date(),
        failureReason: `Job exhausted retries: ${err.message}`,
      },
    });

    console.error(`Notification job ${job.id} failed permanently:`, err);
  }
});

notificationWorker.on('completed', (job) => {
  console.log(`Notification job ${job.id} completed successfully`);
});

async function deliverEmail(
  notification: any,
  email: string,
  data: NotificationJobData,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const rendered = await templateEngine.renderTemplate(
      notification.type,
      'email',
      data.templateVariables || {},
    );

    const result = await emailService.send({
      to: email,
      subject: rendered.subject || notification.title,
      html: rendered.body,
    });

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function deliverSMS(
  notification: any,
  user: any,
  data: NotificationJobData,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    if (!user.phone) {
      return { success: false, error: 'User phone number not available' };
    }

    const rendered = await templateEngine.renderTemplate(
      notification.type,
      'sms',
      data.templateVariables || {},
    );

    const result = await smsService.send({
      phone: user.phone,
      message: rendered.body.substring(0, 160),
    });

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function deliverPush(
  notification: any,
  userId: string,
  data: NotificationJobData,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // TODO: Implement FCM push notification delivery
    // For now, return success as userDevice model doesn't exist yet
    // const deviceTokens = await prisma.userDevice.findMany({
    //   where: { userId },
    //   select: { fcmToken: true },
    // });

    // if (!deviceTokens.length) {
    //   return { success: false, error: 'No device tokens found for user' };
    // }

    // const pushPayloads = deviceTokens.map((device: any) => ({
    //   deviceToken: device.fcmToken!,
    //   title: notification.title,
    //   body: notification.body,
    //   data: notification.data || {},
    // }));

    // const results = await pushService.sendBatch(pushPayloads);
    // const successful = results.filter((r) => r.success).length;

    return {
      success: true, // Placeholder - implement when userDevice model exists
      messageId: 'pending',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function deliverWebhook(
  notification: any,
  data: NotificationJobData,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    if (!data.webhookUrl) {
      return { success: false, error: 'Webhook URL not provided' };
    }

    const result = await webhookService.send({
      url: data.webhookUrl,
      event: notification.type,
      data: {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        ...notification.data,
      },
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function enqueueNotification(
  notificationId: string,
  userId: string,
  channel: any,
  data: Record<string, any> = {},
) {
  const job = await notificationQueue.add(
    `${notificationId}-${channel}`,
    {
      notificationId,
      userId,
      channel,
      ...data,
    },
    {
      priority: data.priority || 50,
      delay: data.scheduledAt ? new Date(data.scheduledAt).getTime() - Date.now() : 0,
    },
  );

  return job;
}

export async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return prisma.notification.deleteMany({
    where: {
      read: true,
      createdAt: { lt: thirtyDaysAgo },
    },
  });
}
