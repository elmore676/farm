import prisma from '../lib/prisma';

export type ReadingContext = {
  cageId: string;
  deviceId?: string | null;
  sensorType: string;
  parameter?: string | null;
  value: number;
};

class AlertEngineService {
  private db = prisma as any;
  private async shouldThrottle(cageId: string, sensorType: string | null, severity: string) {
    const recent = await this.db.ioTAlert.findFirst({
      where: {
        cageId,
        sensorType: sensorType ?? undefined,
        severity,
        isActive: true,
        cooldownUntil: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Boolean(recent);
  }

  private async createAlert(ctx: ReadingContext, severity: string, threshold: number | null, message: string, cooldownMinutes: number) {
    const cooldownUntil = cooldownMinutes
      ? new Date(Date.now() + cooldownMinutes * 60 * 1000)
      : null;

    return this.db.ioTAlert.create({
      data: {
        cageId: ctx.cageId,
        deviceId: ctx.deviceId ?? undefined,
        alertType: 'threshold_violation',
        severity,
        sensorType: ctx.sensorType,
        parameter: ctx.parameter ?? ctx.sensorType,
        currentValue: ctx.value,
        threshold: threshold ?? undefined,
        message,
        isActive: true,
        cooldownUntil: cooldownUntil ?? undefined,
      },
    });
  }

  async evaluateThresholds(ctx: ReadingContext) {
    const thresholds = await this.db.alertThreshold.findMany({
      where: {
        cageId: ctx.cageId,
        sensorType: ctx.sensorType,
        enabled: true,
      },
      orderBy: { severity: 'desc' },
    });

    const createdAlerts = [] as any[];

    for (const rule of thresholds) {
      let violated = false;
      let direction: 'low' | 'high' | null = null;
      if (rule.minValue !== null && rule.minValue !== undefined && ctx.value < rule.minValue) {
        violated = true;
        direction = 'low';
      }
      if (rule.maxValue !== null && rule.maxValue !== undefined && ctx.value > rule.maxValue) {
        violated = true;
        direction = 'high';
      }

      if (!violated) continue;
      const throttled = await this.shouldThrottle(ctx.cageId, ctx.sensorType, rule.severity);
      if (throttled) continue;

      const msg = direction === 'low'
        ? `${ctx.sensorType} below minimum (${ctx.value} < ${rule.minValue})`
        : `${ctx.sensorType} above maximum (${ctx.value} > ${rule.maxValue})`;

      const alert = await this.createAlert(
        ctx,
        rule.severity,
        direction === 'low' ? rule.minValue : rule.maxValue,
        msg,
        rule.cooldownMinutes,
      );
      createdAlerts.push(alert);
    }

    return createdAlerts;
  }

  async resolveAlertsIfRecovered(cageId: string, sensorType: string, value: number) {
    const activeAlerts = await this.db.ioTAlert.findMany({
      where: { cageId, sensorType, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const resolved: string[] = [];

    for (const alert of activeAlerts) {
      const threshold = alert.threshold;
      if (threshold === null || threshold === undefined) continue;
      const isRecovered = alert.currentValue && threshold
        ? (alert.currentValue > threshold ? value <= threshold : value >= threshold)
        : false;
      if (!isRecovered) continue;

      await this.db.ioTAlert.update({
        where: { id: alert.id },
        data: { isActive: false, resolvedAt: new Date(), resolutionNotes: 'Auto-resolved after recovery' },
      });
      resolved.push(alert.id);
    }

    return resolved;
  }
}

export const alertEngineService = new AlertEngineService();
export default alertEngineService;
