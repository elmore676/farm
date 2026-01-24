import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

interface TemplateVariables {
  [key: string]: string | number | boolean;
}

export class TemplateEngine {
  async renderTemplate(
    type: any,
    channel: any,
    variables: TemplateVariables,
    language = 'en',
  ) {
    const template = await prisma.notificationTemplate.findFirst({
      where: { type, channel, language, isActive: true },
    });

    if (!template) {
      throw new Error(`Template not found for ${type} on ${channel} (${language})`);
    }

    let rendered = template.body;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return {
      subject: template.subject ? this.renderString(template.subject, variables) : undefined,
      body: rendered,
      template,
    };
  }

  private renderString(str: string, variables: TemplateVariables): string {
    let result = str;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }
}

export interface NotificationPayload {
  type: any;
  recipientId: string;
  title: string;
  body?: string;
  channels: any[];
  priority?: string;
  data?: Record<string, any>;
  relatedEntityId?: string;
  relatedEntityType?: string;
  templateVariables?: TemplateVariables;
}

export interface SendNotificationOptions {
  userId: string;
  channels: any[];
  priority?: any;
  scheduledAt?: Date;
}

export class NotificationService {
  private templateEngine: TemplateEngine;

  constructor() {
    this.templateEngine = new TemplateEngine();
  }

  async createNotification(payload: NotificationPayload) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: payload.recipientId,
        type: payload.type,
        title: payload.title,
        body: payload.body || '',
        priority: payload.priority || 'medium',
        data: payload.data,
        relatedEntityId: payload.relatedEntityId,
        relatedEntityType: payload.relatedEntityType,
      },
    });

    return notification;
  }

  async sendNotification(payload: NotificationPayload, options: SendNotificationOptions) {
    const notification = await this.createNotification(payload);

    for (const channel of options.channels) {
      await prisma.notificationQueue.create({
        data: {
          jobId: `${notification.id}-${channel}-${Date.now()}`,
          userId: options.userId,
          type: payload.type,
          channels: [channel],
          data: {
            notificationId: notification.id,
            templateVariables: payload.templateVariables,
            ...payload.data,
          },
          priority: this.priorityToNumber(options.priority || 'medium'),
          scheduledAt: options.scheduledAt,
        },
      });
    }

    return notification;
  }

  async markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async getUserNotifications(userId: string, options?: { skip?: number; take?: number }) {
    return prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip: options?.skip || 0,
      take: options?.take || 20,
      include: { deliveries: true },
    });
  }

  async deleteNotification(notificationId: string) {
    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async getPreferences(userId: string) {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.createDefaultPreferences(userId);
    }

    return prefs;
  }

  async updatePreferences(userId: string, updates: any) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: updates,
      create: {
        userId,
        type: 'system_update',
        channels: ['in_app'],
        ...updates,
      },
    });
  }

  private async createDefaultPreferences(userId: string) {
    return prisma.notificationPreference.create({
      data: {
        userId,
        type: 'system_update',
        channels: ['in_app'],
        frequency: 'immediate',
        enabled: true,
      },
    });
  }

  private priorityToNumber(priority?: any): number {
    const map: Record<string, number> = { critical: 100, high: 75, medium: 50, low: 25 };
    return map[priority as string] || 25;
  }
}

export const notificationService = new NotificationService();
