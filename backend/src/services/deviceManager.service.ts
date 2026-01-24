import { randomBytes } from 'crypto';
import prisma from '../lib/prisma';

export type RegisterDeviceInput = {
  cageId: string;
  name: string;
  deviceType: string;
  serialNumber: string;
  sensorTypes?: string[];
  firmwareVersion?: string;
  location?: string | null;
  timezone?: string;
};

export type UpdateDeviceStatusInput = {
  deviceId: string;
  status?: string;
  lastSeen?: Date;
  batteryLevel?: number | null;
  signalStrength?: number | null;
};

class DeviceManagerService {
  // Using prisma as any to avoid TS client name casing issues
  private db = prisma as any;
  private generateApiKey() {
    return randomBytes(32).toString('hex');
  }

  async registerDevice(input: RegisterDeviceInput) {
    const apiKey = this.generateApiKey();
    return this.db.ioTDevice.create({
      data: {
        cageId: input.cageId,
        name: input.name,
        deviceType: input.deviceType,
        serialNumber: input.serialNumber,
        sensorTypes: input.sensorTypes ?? [],
        firmwareVersion: input.firmwareVersion ?? '1.0.0',
        location: input.location ?? undefined,
        timezone: input.timezone ?? 'UTC',
        status: 'offline',
        apiKey,
        isActive: true,
      },
    });
  }

  async rotateApiKey(deviceId: string) {
    const apiKey = this.generateApiKey();
    const device = await this.db.ioTDevice.update({
      where: { id: deviceId },
      data: { apiKey },
    });
    return { device, apiKey };
  }

  async getDeviceByApiKey(apiKey: string) {
    return this.db.ioTDevice.findUnique({ where: { apiKey } });
  }

  async updateStatus(input: UpdateDeviceStatusInput) {
    return this.db.ioTDevice.update({
      where: { id: input.deviceId },
      data: {
        status: input.status ?? undefined,
        lastSeen: input.lastSeen ?? new Date(),
        batteryLevel: input.batteryLevel ?? undefined,
        signalStrength: input.signalStrength ?? undefined,
      },
    });
  }

  async touch(deviceId: string) {
    return this.updateStatus({ deviceId, lastSeen: new Date(), status: 'online' });
  }

  async getLatestConfiguration(deviceId: string) {
    return this.db.deviceConfiguration.findFirst({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listDevices(cageId?: string) {
    return this.db.ioTDevice.findMany({
      where: cageId ? { cageId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const deviceManagerService = new DeviceManagerService();
export default deviceManagerService;
