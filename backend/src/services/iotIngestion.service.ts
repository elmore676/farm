import prisma from '../lib/prisma';
import { deviceManagerService } from './deviceManager.service';
import { alertEngineService } from './alertEngine.service';

export type ReadingInput = {
  sensorType: string;
  value: number;
  unit?: string;
  timestamp?: Date;
  quality?: string;
  accuracy?: number | null;
  metadata?: Record<string, unknown> | null;
};

class IoTIngestionService {
  private db = prisma as any;
  async ingestWithApiKey(apiKey: string, readings: ReadingInput[]) {
    const device = await deviceManagerService.getDeviceByApiKey(apiKey);
    if (!device || !device.isActive) {
      throw new Error('Device not found or inactive');
    }

    await deviceManagerService.touch(device.id);

    return this.ingest(device.id, device.cageId, readings);
  }

  async ingest(deviceId: string, cageId: string, readings: ReadingInput[]) {
    if (!readings.length) return { count: 0, alerts: [] as any[] };

    const payload = readings.map((r) => ({
      deviceId,
      cageId,
      sensorType: r.sensorType,
      value: r.value,
      unit: r.unit ?? '',
      quality: r.quality ?? 'good',
      accuracy: r.accuracy ?? undefined,
      timestamp: r.timestamp ?? new Date(),
      receivedAt: new Date(),
      metadata: r.metadata ?? undefined,
    }));

    const created = await this.db.sensorReading.createMany({ data: payload });

    const alerts: any[] = [];
    for (const r of payload) {
      const newAlerts = await alertEngineService.evaluateThresholds({
        cageId,
        deviceId,
        sensorType: r.sensorType,
        value: r.value,
        parameter: r.sensorType,
      });
      alerts.push(...newAlerts);
      await alertEngineService.resolveAlertsIfRecovered(cageId, r.sensorType, r.value);
    }

    return { count: created.count, alerts };
  }
}

export const iotIngestionService = new IoTIngestionService();
export default iotIngestionService;
