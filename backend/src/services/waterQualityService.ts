import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WaterQualityService {
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.cageId) where.cageId = filters.cageId;
    if (filters.cycleId) where.cycleId = filters.cycleId;

    const [records, total] = await Promise.all([
      prisma.waterQuality.findMany({
        where,
        skip: offset,
        take: limit,
        include: { cage: true, cycle: true },
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.waterQuality.count({ where }),
    ]);

    return {
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const record = await prisma.waterQuality.findUnique({
      where: { id },
      include: { cage: true, cycle: true },
    });
    if (!record) throw new Error('Water quality record not found');
    return record;
  }

  async create(data: any) {
    return await prisma.waterQuality.create({
      data: {
        cageId: data.cageId,
        cycleId: data.cycleId,
        recordedAt: new Date(data.recordedAt || new Date()),
        temperature: data.temperature,
        ph: data.ph,
        dissolvedOxygen: data.dissolvedOxygen,
        ammonia: data.ammonia,
        nitrite: data.nitrite,
        nitrate: data.nitrate,
        turbidity: data.turbidity,
        salinity: data.salinity,
        source: data.source,
        notes: data.notes,
        alertLevel: data.alertLevel || 'normal',
      },
      include: { cage: true, cycle: true },
    });
  }

  async update(id: string, data: any) {
    return await prisma.waterQuality.update({
      where: { id },
      data: {
        temperature: data.temperature,
        ph: data.ph,
        dissolvedOxygen: data.dissolvedOxygen,
        ammonia: data.ammonia,
        nitrite: data.nitrite,
        nitrate: data.nitrate,
        turbidity: data.turbidity,
        salinity: data.salinity,
        source: data.source,
        notes: data.notes,
        alertLevel: data.alertLevel,
      },
      include: { cage: true, cycle: true },
    });
  }

  async delete(id: string) {
    return await prisma.waterQuality.delete({ where: { id } });
  }

  async getLatest(cageId: string) {
    return await prisma.waterQuality.findFirst({
      where: { cageId },
      orderBy: { recordedAt: 'desc' },
      include: { cage: true, cycle: true },
    });
  }

  async getTrends(cageId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await prisma.waterQuality.findMany({
      where: {
        cageId,
        recordedAt: { gte: startDate },
      },
      orderBy: { recordedAt: 'asc' },
    });

    if (records.length === 0) return null;

    const avgTemp = records.reduce((sum, r) => sum + (r.temperature || 0), 0) / records.length;
    const avgPH = records.reduce((sum, r) => sum + (r.ph || 0), 0) / records.length;
    const avgDO = records.reduce((sum, r) => sum + (r.dissolvedOxygen || 0), 0) / records.length;

    return {
      records,
      averages: { temperature: avgTemp, ph: avgPH, dissolvedOxygen: avgDO },
      days,
    };
  }

  async checkAlerts(cageId: string) {
    const latest = await this.getLatest(cageId);
    if (!latest) return [];

    const alerts = [];

    // Check temperature - using optional chaining and nullish coalescing
    const temp = latest.temperature;
    if (temp !== null && temp !== undefined && (temp < 20 || temp > 32)) {
      alerts.push({ type: 'temperature', value: temp, status: 'alert' });
    }

    // Check pH
    const phValue = latest.ph;
    if (phValue !== null && phValue !== undefined && (phValue < 6.5 || phValue > 8.5)) {
      alerts.push({ type: 'pH', value: phValue, status: 'alert' });
    }

    // Check dissolved oxygen
    const doValue = latest.dissolvedOxygen;
    if (doValue !== null && doValue !== undefined && doValue < 5) {
      alerts.push({ type: 'dissolvedOxygen', value: doValue, status: 'critical' });
    }

    // Check ammonia
    const ammoniaValue = latest.ammonia;
    if (ammoniaValue !== null && ammoniaValue !== undefined && ammoniaValue > 0.5) {
      alerts.push({ type: 'ammonia', value: ammoniaValue, status: 'alert' });
    }

    return alerts;
  }
}

export default new WaterQualityService();
