/**
 * Example: Integrate notifications into water quality monitoring
 * This shows how to trigger notifications from existing system events
 */

import { PrismaClient, WaterAlertLevel } from '@prisma/client';
import { NotificationTriggers } from '../services/notification-triggers.service';

const prisma = new PrismaClient();

/**
 * Hook this into water quality check/create endpoint
 */
export async function handleWaterQualityCheck(
  cageId: string,
  data: {
    temperature?: number;
    ph?: number;
    dissolvedOxygen?: number;
    ammonia?: number;
    nitrite?: number;
    nitrate?: number;
    turbidity?: number;
  },
) {
  const cage = await prisma.cage.findUnique({ where: { id: cageId } });
  if (!cage) return;

  // Define safe thresholds
  const thresholds = {
    temperature: { min: 24, max: 30 },
    ph: { min: 6.5, max: 8.5 },
    dissolvedOxygen: { min: 5, max: 12 },
    ammonia: { min: 0, max: 0.5 },
    nitrite: { min: 0, max: 0.1 },
    nitrate: { min: 0, max: 40 },
    turbidity: { min: 0, max: 40 },
  };

  let alertLevel: any = 'normal';

  // Check temperature
  if (data.temperature) {
    if (data.temperature < thresholds.temperature.min || data.temperature > thresholds.temperature.max) {
      alertLevel = 'critical';
      await NotificationTriggers.triggerWaterQualityAlert(
        cageId,
        'Temperature',
        data.temperature,
        data.temperature < 24 ? 24 : 30,
      );
    }
  }

  // Check pH
  if (data.ph) {
    if (data.ph < thresholds.ph.min || data.ph > thresholds.ph.max) {
      alertLevel = 'warning';
      await NotificationTriggers.triggerWaterQualityAlert(
        cageId,
        'pH Level',
        data.ph,
        data.ph < 6.5 ? 6.5 : 8.5,
      );
    }
  }

  // Check dissolved oxygen
  if (data.dissolvedOxygen) {
    if (data.dissolvedOxygen < thresholds.dissolvedOxygen.min) {
      alertLevel = 'critical';
      await NotificationTriggers.triggerWaterQualityAlert(
        cageId,
        'Dissolved Oxygen',
        data.dissolvedOxygen,
        thresholds.dissolvedOxygen.min,
      );
    }
  }

  // Check ammonia
  if (data.ammonia !== undefined && data.ammonia > thresholds.ammonia.max) {
    alertLevel = 'critical';
    await NotificationTriggers.triggerWaterQualityAlert(
      cageId,
      'Ammonia',
      data.ammonia,
      thresholds.ammonia.max,
    );
  }

  // Check nitrite
  if (data.nitrite !== undefined && data.nitrite > thresholds.nitrite.max) {
    alertLevel = 'warning';
    await NotificationTriggers.triggerWaterQualityAlert(
      cageId,
      'Nitrite',
      data.nitrite,
      thresholds.nitrite.max,
    );
  }

  // Check nitrate
  if (data.nitrate !== undefined && data.nitrate > thresholds.nitrate.max) {
    alertLevel = 'warning';
    await NotificationTriggers.triggerWaterQualityAlert(
      cageId,
      'Nitrate',
      data.nitrate,
      thresholds.nitrate.max,
    );
  }

  // Check turbidity
  if (data.turbidity !== undefined && data.turbidity > thresholds.turbidity.max) {
    alertLevel = WaterAlertLevel.warning;
    await NotificationTriggers.triggerWaterQualityAlert(
      cageId,
      'Turbidity',
      data.turbidity,
      thresholds.turbidity.max,
    );
  }

  // Log water quality record
  const activeCycle = await prisma.cycle.findFirst({
    where: { cageId, status: 'active' },
  });

  return prisma.waterQuality.create({
    data: {
      cageId,
      cycleId: activeCycle?.id,
      recordedAt: new Date(),
      temperature: data.temperature,
      ph: data.ph,
      dissolvedOxygen: data.dissolvedOxygen,
      ammonia: data.ammonia,
      nitrite: data.nitrite,
      nitrate: data.nitrate,
      turbidity: data.turbidity,
      alertLevel,
      source: 'iot', // or 'manual'
      notes: `Alert level: ${alertLevel}`,
    },
  });
}

/**
 * Hook into daily log/mortality recording
 */
export async function handleDailyLogWithMortalityCheck(
  cycleId: string,
  mortalityCount: number,
  initialStock: number,
) {
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId }, include: { cage: true } });
  if (!cycle) return;

  const mortalityRate = (mortalityCount / initialStock) * 100;
  const MORTALITY_THRESHOLD = 15; // Alert if >15% mortality

  if (mortalityRate > MORTALITY_THRESHOLD) {
    await NotificationTriggers.triggerMortalityAlert(cycleId, mortalityRate, mortalityCount);
  }

  // Update cycle mortality
  return prisma.cycle.update({
    where: { id: cycleId },
    data: {
      mortality: mortalityCount,
      dailyLogs: {
        create: {
          date: new Date(),
          notes: `Mortality: ${mortalityCount} (${mortalityRate.toFixed(2)}%)`,
        },
      },
    },
  });
}

/**
 * Hook into feed stock management
 */
export async function handleFeedStockUpdate(
  feedType: string,
  currentStock: number,
  costPerKg: number,
) {
  const MIN_STOCK_THRESHOLD = 100; // Alert if <100kg

  if (currentStock < MIN_STOCK_THRESHOLD) {
    await NotificationTriggers.triggerFeedStockWarning(
      feedType,
      currentStock,
      MIN_STOCK_THRESHOLD,
      costPerKg,
    );
  }

  // Note: Creating new FeedStock record instead of upsert since feedType alone is not unique
  return prisma.feedStock.create({
    data: {
      feedType,
      quantityKg: currentStock,
      costPerKg,
      supplierName: 'Default',
    },
  });
}

/**
 * Hook into harvest scheduling
 */
export async function scheduleHarvestReminders(cycleId: string) {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { cage: true },
  });

  if (!cycle || !cycle.endDate) return;

  const harvestDate = cycle.endDate;
  const reminderDate = new Date(harvestDate.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before

  // Schedule reminder job (would be queued with scheduled time)
  // This could integrate with a cron job or scheduler
  if (reminderDate > new Date()) {
    await NotificationTriggers.triggerHarvestReminder(
      cycleId,
      harvestDate,
      cycle.biomassEnd || 4000,
      4000 * 280, // Estimate at 280/kg
    );
  }
}

/**
 * Hook into payout processing
 */
export async function notifyPayoutProcessed(investorId: string, amount: number, cageName: string, roi: number) {
  await NotificationTriggers.triggerPayoutNotification(investorId, amount, cageName, roi, 'processed');
}

/**
 * Hook into authentication
 */
export async function sendAuthOTP(userId: string, otp: string) {
  await NotificationTriggers.triggerAuthOTP(userId, otp, 10); // 10 minutes expiry
}

/**
 * Hook into password reset
 */
export async function sendPasswordReset(userId: string, resetToken: string) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await NotificationTriggers.triggerPasswordReset(userId, resetLink);
}

/**
 * Example usage in a water quality controller:
 * 
 * export const createWaterQualityLog = asyncHandler(async (req: Request, res: Response) => {
 *   const waterData = req.body;
 *   
 *   const log = await handleWaterQualityCheck(waterData.cageId, {
 *     temperature: waterData.temperature,
 *     ph: waterData.ph,
 *     dissolvedOxygen: waterData.dissolvedOxygen,
 *     ammonia: waterData.ammonia,
 *     nitrite: waterData.nitrite,
 *     nitrate: waterData.nitrate,
 *     turbidity: waterData.turbidity,
 *   });
 * 
 *   res.json({ data: log });
 * });
 */
