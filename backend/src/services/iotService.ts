import prisma from '../lib/prisma';

export class IotService {
  async getDevices(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.cageId) where.cageId = filters.cageId;
    if (filters.status) where.status = filters.status;

    const [devices, total] = await Promise.all([
      prisma.ioTDevice.findMany({
        where,
        skip: offset,
        take: limit,
        include: { cage: true, readings: true, alerts: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ioTDevice.count({ where }),
    ]);

    return {
      data: devices,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDeviceById(id: string) {
    const device = await prisma.ioTDevice.findUnique({
      where: { id },
      include: { cage: true, readings: true, alerts: true },
    });
    if (!device) throw new Error('IoT device not found');
    return device;
  }

  async registerDevice(data: any) {
    return await prisma.ioTDevice.create({
      data: {
        cageId: data.cageId,
        name: data.name,
        deviceType: data.deviceType,
        serialNumber: data.serialNumber,
        apiKey: data.apiKey,
        firmwareVersion: data.firmwareVersion,
        location: data.location,
        status: 'offline',
        sensorTypes: data.sensorTypes || [],
        isActive: true,
      },
      include: { cage: true, readings: true, alerts: true },
    });
  }

  async updateDevice(id: string, data: any) {
    return await prisma.ioTDevice.update({
      where: { id },
      data: {
        status: data.status,
        location: data.location,
        firmwareVersion: data.firmwareVersion,
        lastSeen: data.lastSeen || new Date(),
        batteryLevel: data.batteryLevel,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: { cage: true, readings: true, alerts: true },
    });
  }

  async deleteDevice(id: string) {
    return await prisma.ioTDevice.delete({ where: { id } });
  }

  async recordReading(deviceId: string, data: any) {
    const device = await prisma.ioTDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error('IoT device not found');

    const reading = await prisma.sensorReading.create({
      data: {
        deviceId,
        cageId: data.cageId || device.cageId,
        sensorType: data.sensorType,
        value: data.value,
        unit: data.unit,
        quality: data.quality || 'good',
        accuracy: data.accuracy,
        timestamp: new Date(data.timestamp || data.recordedAt),
        batchId: data.batchId,
        metadata: data.metadata,
      },
    });

    // Check if reading triggers any alerts
    await this.checkAlerts({ cageId: reading.cageId, sensorType: reading.sensorType, value: reading.value, unit: reading.unit });

    return reading;
  }

  async getSensorReadings(deviceId: string, sensorType?: string, hours: number = 24) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const where: any = {
      deviceId,
      timestamp: { gte: startDate },
    };

    if (sensorType) where.sensorType = sensorType;

    return await prisma.sensorReading.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async checkAlerts(reading: { cageId: string | null; sensorType: string; value: number; unit?: string }) {
    if (!reading.cageId) return;
    const thresholds = await prisma.alertThreshold.findMany({ where: { cageId: reading.cageId } });

    for (const threshold of thresholds) {
      let isAlert = false;

      if (threshold.minValue !== null && reading.value < threshold.minValue) isAlert = true;
      if (threshold.maxValue !== null && reading.value > threshold.maxValue) isAlert = true;

      if (isAlert) {
        await prisma.ioTAlert.create({
          data: {
            cageId: reading.cageId,
            alertType: 'threshold_violation',
            severity: threshold.severity || 'warning',
            sensorType: reading.sensorType,
            parameter: threshold.parameter,
            currentValue: reading.value,
            threshold: threshold.minValue || threshold.maxValue,
            message: `${reading.sensorType} alert: ${reading.value}${reading.unit ?? ''}`,
            isActive: true,
          },
        });
      }
    }
  }

  async getAlerts(filter: { cageId?: string; deviceId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filter.cageId) where.cageId = filter.cageId;
    if (filter.deviceId) where.deviceId = filter.deviceId;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    return await prisma.ioTAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSummary(cageId: string) {
    const devices = await prisma.ioTDevice.findMany({
      where: { cageId },
      include: { readings: true, alerts: true },
    });

    const activeDevices = devices.filter((d) => d.status === 'online').length;
    const activeAlerts = devices.reduce((sum, d) => sum + d.alerts.filter((a: any) => a.isActive).length, 0);

    return {
      totalDevices: devices.length,
      activeDevices,
      activeAlerts,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.deviceType,
        status: d.status,
        lastSeen: d.lastSeen,
        alertCount: d.alerts.filter((a: any) => a.isActive).length,
      })),
    };
  }
}

export default new IotService();
