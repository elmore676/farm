import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FeedService {
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.feedType) where.feedType = filters.feedType;

    const [stocks, total] = await Promise.all([
      prisma.feedStock.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedStock.count({ where }),
    ]);

    return {
      data: stocks,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const stock = await prisma.feedStock.findUnique({
      where: { id },
    });
    if (!stock) throw new Error('Feed stock not found');
    return stock;
  }

  async create(data: any) {
    return await prisma.feedStock.create({
      data: {
        feedType: data.feedType,
        quantityKg: data.quantity || data.quantityKg,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        costPerKg: data.unitCost || data.costPerKg,
        supplierName: data.supplier || data.supplierName,
      },
    });
  }

  async update(id: string, data: any) {
    return await prisma.feedStock.update({
      where: { id },
      data: {
        quantityKg: data.quantity || data.quantityKg,
        costPerKg: data.unitCost || data.costPerKg,
      },
    });
  }

  async delete(id: string) {
    return await prisma.feedStock.delete({ where: { id } });
  }

  async recordUsage(data: any) {
    // FeedUsage doesn't have feedStockId - it just tracks usage by feedType
    return await prisma.feedUsage.create({
      data: {
        cycleId: data.cycleId,
        cageId: data.cageId,
        feedType: data.feedType,
        quantityKg: data.quantity || data.quantityKg,
        date: new Date(data.usageDate || data.date),
        time: data.time,
        wastageKg: data.wastage || data.wastageKg,
      },
    });
  }

  async getInventory() {
    const stocks = await prisma.feedStock.findMany();

    const totalQuantity = stocks.reduce((sum, s) => sum + s.quantityKg, 0);
    const totalValue = stocks.reduce((sum, s) => sum + s.quantityKg * s.costPerKg, 0);

    return {
      stocks,
      totalQuantity,
      totalValue,
    };
  }

  async getAnalytics() {
    const usages = await prisma.feedUsage.findMany();

    const byType = new Map();
    usages.forEach((usage) => {
      byType.set(usage.feedType, (byType.get(usage.feedType) || 0) + usage.quantityKg);
    });

    return {
      totalUsed: usages.reduce((sum, u) => sum + u.quantityKg, 0),
      usageByType: Object.fromEntries(byType),
      recentUsages: usages.slice(-10),
    };
  }
}

export default new FeedService();
