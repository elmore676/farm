import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';

const prisma = new PrismaClient() as any;

/**
 * Notification trigger handlers for various system events
 */

export class NotificationTriggers {
  /**
   * Trigger water quality alert when thresholds are exceeded
   */
  static async triggerWaterQualityAlert(cageId: string, parameter: string, currentValue: number, threshold: number) {
    const cage = await prisma.cage.findUnique({ where: { id: cageId } });
    if (!cage) return;

    const managers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] } },
    });

    for (const manager of managers) {
      await notificationService.sendNotification(
        {
          type: 'water_quality_alert',
          recipientId: manager.id,
          title: `Water Quality Alert - ${cage.name}`,
          body: `${parameter} level (${currentValue}) exceeds safe threshold of ${threshold}`,
          channels: ['in_app', 'email'],
          priority: 'critical',
          relatedEntityId: cageId,
          relatedEntityType: 'cage',
          templateVariables: {
            cageName: cage.name,
            parameter,
            currentValue: String(currentValue),
            threshold: String(threshold),
            timestamp: new Date().toISOString(),
            recommendedActions: `Increase aeration and test water quality. Consider partial water exchange.`,
          },
        },
        {
          userId: manager.id,
          channels: ['in_app', 'email'],
          priority: 'critical',
        },
      );
    }
  }

  /**
   * Trigger mortality alert when mortality exceeds threshold
   */
  static async triggerMortalityAlert(cycleId: string, mortalityRate: number, fishLost: number) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { cage: true },
    });
    if (!cycle) return;

    const investors = await prisma.investment.findMany({
      where: { cageId: cycle.cageId },
      include: { investor: true },
    });

    for (const investment of investors) {
      const user = await prisma.user.findFirst({
        where: { email: investment.investor.email || '' },
      });

      if (user) {
        await notificationService.sendNotification(
          {
            type: 'mortality_alert',
            recipientId: user.id,
            title: `Mortality Alert - ${cycle.cage?.name}`,
            body: `Mortality rate has reached ${mortalityRate}%`,
            channels: ['in_app', 'email', 'sms'],
            priority: 'high',
            relatedEntityId: cycleId,
            relatedEntityType: 'cycle',
            templateVariables: {
              cageName: cycle.cage?.name || 'Unknown',
              mortalityRate: String(mortalityRate),
              threshold: '15',
              fishLost: String(fishLost),
              timestamp: new Date().toISOString(),
            },
          },
          {
            userId: user.id,
            channels: ['in_app', 'email', 'sms'],
            priority: 'high',
          },
        );
      }
    }
  }

  /**
   * Trigger feed stock warning when stock runs low
   */
  static async triggerFeedStockWarning(feedType: string, currentStock: number, minThreshold: number, costPerKg: number) {
    const managers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] } },
    });

    for (const manager of managers) {
      await notificationService.sendNotification(
        {
          type: 'feed_stock_warning',
          recipientId: manager.id,
          title: `Feed Stock Warning - ${feedType}`,
          body: `${feedType} stock (${currentStock}kg) is below minimum threshold (${minThreshold}kg)`,
          channels: ['in_app', 'email'],
          priority: 'high',
          templateVariables: {
            feedType,
            currentStock: String(currentStock),
            minThreshold: String(minThreshold),
            costPerKg: String(costPerKg),
          },
        },
        {
          userId: manager.id,
          channels: ['in_app', 'email'],
          priority: 'high',
        },
      );
    }
  }

  /**
   * Trigger harvest reminder 3 days before expected harvest
   */
  static async triggerHarvestReminder(cycleId: string, harvestDate: Date, expectedBiomass: number, estimatedRevenue: number) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { cage: true },
    });
    if (!cycle) return;

    const investors = await prisma.investment.findMany({
      where: { cageId: cycle.cageId },
      include: { investor: true },
    });

    const daysUntilHarvest = Math.ceil((harvestDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    for (const investment of investors) {
      const user = await prisma.user.findFirst({
        where: { email: investment.investor.email || '' },
      });

      if (user) {
        await notificationService.sendNotification(
          {
            type: 'harvest_reminder',
            recipientId: user.id,
            title: `Harvest Reminder - ${cycle.cage?.name}`,
            body: `Harvest for ${cycle.cage?.name} is in ${daysUntilHarvest} days`,
            channels: ['in_app', 'email'],
            priority: 'medium',
            relatedEntityId: cycleId,
            relatedEntityType: 'cycle',
            templateVariables: {
              cageName: cycle.cage?.name || 'Unknown',
              harvestDate: harvestDate.toISOString().split('T')[0],
              daysUntilHarvest: String(daysUntilHarvest),
              expectedBiomass: String(expectedBiomass),
              estimatedRevenue: String(estimatedRevenue),
            },
          },
          {
            userId: user.id,
            channels: ['in_app', 'email'],
            priority: 'medium',
          },
        );
      }
    }
  }

  /**
   * Trigger payout notification when payouts are processed
   */
  static async triggerPayoutNotification(investorId: string, amount: number, cageName: string, roi: number, status: string) {
    const investor = await prisma.investor.findUnique({ where: { id: investorId } });
    if (!investor) return;

    const user = await prisma.user.findFirst({
      where: { email: investor.email || '' },
    });

    if (user) {
      await notificationService.sendNotification(
        {
          type: 'payout_notification',
          recipientId: user.id,
          title: `Payout Processed - ${cageName}`,
          body: `Your payout of ${amount} has been ${status}`,
          channels: ['in_app', 'email', 'sms'],
          priority: 'high',
          data: { amount, roi },
          templateVariables: {
            amount: String(amount),
            cageName,
            roi: String(roi),
            status,
            timestamp: new Date().toISOString(),
          },
        },
        {
          userId: user.id,
          channels: ['in_app', 'email', 'sms'],
          priority: 'high',
        },
      );
    }
  }

  /**
   * Trigger system update notification
   */
  static async triggerSystemUpdate(title: string, message: string, details: string) {
    const users = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager', 'viewer'] } },
    });

    for (const user of users) {
      await notificationService.sendNotification(
        {
          type: 'system_update',
          recipientId: user.id,
          title,
          body: message,
          channels: ['in_app'],
          priority: 'medium',
          templateVariables: {
            title,
            message,
            details,
          },
        },
        {
          userId: user.id,
          channels: ['in_app'],
          priority: 'medium',
        },
      );
    }
  }

  /**
   * Trigger authentication OTP notification
   */
  static async triggerAuthOTP(userId: string, otp: string, expiresIn: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    await notificationService.sendNotification(
      {
        type: 'auth_otp',
        recipientId: userId,
        title: 'Your One-Time Password',
        body: `Your OTP is: ${otp}`,
        channels: ['sms', 'email'],
        priority: 'critical',
        templateVariables: {
          otp,
          expiresIn: String(expiresIn),
        },
      },
      {
        userId,
        channels: ['sms', 'email'],
        priority: 'critical',
      },
    );
  }

  /**
   * Trigger password reset notification
   */
  static async triggerPasswordReset(userId: string, resetLink: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    await notificationService.sendNotification(
      {
        type: 'password_reset',
        recipientId: userId,
        title: 'Password Reset Request',
        body: 'A password reset request has been received for your account',
        channels: ['email'],
        priority: 'high',
        templateVariables: {
          resetLink,
          expiresIn: '1 hour',
        },
      },
      {
        userId,
        channels: ['email'],
        priority: 'high',
      },
    );
  }
}

