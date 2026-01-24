import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CageService {
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };

    const [cages, total] = await Promise.all([
      prisma.cage.findMany({
        where,
        skip: offset,
        take: limit,
        include: { 
          cycles: true, 
          investments: { include: { investor: true } }, 
          equipment: true 
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cage.count({ where }),
    ]);

    return {
      data: cages,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const cage = await prisma.cage.findUnique({
      where: { id },
      include: { cycles: true, investments: { include: { investor: true } }, equipment: true },
    });
    if (!cage) throw new Error('Cage not found');
    return cage;
  }

  async create(data: any) {
    return await prisma.cage.create({
      data: {
        code: data.code,
        name: data.name,
        species: data.species || 'Tilapia',
        location: data.location?.label || 'Lake Victoria',
        locationLabel: data.location?.label,
        capacity: data.capacity,
        currentStock: data.currentStock || 0,
        status: data.status || 'idle',
        lat: data.location?.lat ?? data.latitude ?? -1.2921,
        lng: data.location?.lng ?? data.longitude ?? 36.8219,
        length: data.dimensions?.length,
        width: data.dimensions?.width,
        depth: data.dimensions?.depth,
      },
      include: { cycles: true, investments: true, equipment: true },
    });
  }

  async update(id: string, data: any) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.species) updateData.species = data.species;
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
    if (data.status) updateData.status = data.status;
    
    // Handle location nested object
    if (data.location?.label) updateData.location = data.location.label;
    if (data.location?.label) updateData.locationLabel = data.location.label;
    if ((data.location?.lat ?? data.latitude) !== undefined) updateData.lat = data.location?.lat ?? data.latitude;
    if ((data.location?.lng ?? data.longitude) !== undefined) updateData.lng = data.location?.lng ?? data.longitude;
    
    // Handle dimensions nested object
    if (data.dimensions?.length !== undefined) updateData.length = data.dimensions.length;
    if (data.dimensions?.width !== undefined) updateData.width = data.dimensions.width;
    if (data.dimensions?.depth !== undefined) updateData.depth = data.dimensions.depth;
    
    return await prisma.cage.update({
      where: { id },
      data: updateData,
      include: { cycles: true, investments: true, equipment: true },
    });
  }

  async delete(id: string) {
    // Check for active cycles
    const activeCycleCount = await prisma.cycle.count({
      where: { 
        cageId: id,
        status: { in: ['active', 'planned'] }
      }
    });

    if (activeCycleCount > 0) {
      throw new Error(`Cannot delete cage with ${activeCycleCount} active cycle(s). Please complete or cancel cycles first.`);
    }

    // Check for any investments
    const investmentCount = await prisma.investment.count({
      where: { cageId: id }
    });

    if (investmentCount > 0) {
      throw new Error(`Cannot delete cage with ${investmentCount} investment(s). Cage has financial records.`);
    }

    // Check for payouts tied to cycles in this cage
    const payoutCount = await prisma.payout.count({
      where: { cycle: { cageId: id } }
    });

    if (payoutCount > 0) {
      throw new Error(`Cannot delete cage with ${payoutCount} payout(s). Archive payouts or remove cycles first.`);
    }

    return await prisma.cage.delete({ where: { id } });
  }

  async getCurrentCycle(cageId: string) {
    return await prisma.cycle.findFirst({
      where: { cageId, status: 'active' },
      include: { dailyLogs: true, harvests: true },
    });
  }

  async getStats() {
    const [totalCages, activeCages, totalCapacity] = await Promise.all([
      prisma.cage.count(),
      prisma.cage.count({ where: { status: 'active' } }),
      prisma.cage.aggregate({ _sum: { capacity: true } }),
    ]);

    return {
      totalCages,
      activeCages,
      totalCapacity: totalCapacity._sum.capacity || 0,
    };
  }
}

export default new CageService();
