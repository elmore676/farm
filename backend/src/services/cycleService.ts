import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CycleService {
  // Transform database cycle to frontend-expected format
  private transformCycle(cycle: any) {
    const now = new Date();
    const startDate = new Date(cycle.startDate);
    const daysInCycle = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate total feed used from feedUsage records
    const totalFeedUsed = cycle.feedUsage?.reduce((sum: number, f: any) => 
      sum + (f.quantityKg || f.quantity || 0), 0) || 0;
    
    // Calculate total feed cost
    const totalFeedCost = cycle.feedUsage?.reduce((sum: number, f: any) => 
      sum + ((f.quantityKg || f.quantity || 0) * (f.costPerKg || 0)), 0) || 0;
    
    // Calculate total mortality from dailyLogs
    const totalMortality = cycle.dailyLogs?.reduce((sum: number, log: any) => 
      sum + (log.mortality || 0), 0) || cycle.mortality || 0;
    
    // Calculate current stock
    const currentStock = (cycle.initialStock || 0) - totalMortality;
    
    // Calculate survival rate
    const survivalRate = cycle.initialStock > 0 
      ? (currentStock / cycle.initialStock) * 100 
      : 100;
    
    // Calculate current biomass (estimate from latest data or start)
    const currentBiomass = cycle.biomassEnd || cycle.biomassStart || 0;
    
    // Calculate current average weight (estimate)
    const currentAvgWeight = currentStock > 0 ? currentBiomass / currentStock : 0;
    
    // Calculate growth rate (g/day)
    const initialWeight = cycle.biomassStart && cycle.initialStock ? 
      cycle.biomassStart / cycle.initialStock : 0;
    const growthRate = daysInCycle > 0 ? 
      ((currentAvgWeight - initialWeight) * 1000) / daysInCycle : 0;
    
    // Expected duration from start to end date
    const expectedDuration = cycle.endDate ? 
      Math.floor((new Date(cycle.endDate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 120;
    
    // Aggregate actual costs from expenses
    const actualCosts: Record<string, number> = {
      fingerlings: 0,
      feed: totalFeedCost,
      labor: 0,
      medication: 0,
      utilities: 0,
      other: 0,
    };
    
    if (cycle.expenses) {
      cycle.expenses.forEach((expense: any) => {
        const category = expense.category?.toLowerCase() || 'other';
        if (actualCosts[category] !== undefined) {
          actualCosts[category] += expense.amount || 0;
        } else {
          actualCosts.other += expense.amount || 0;
        }
      });
    }
    
    return {
      ...cycle,
      cageName: cycle.cage?.name || 'Unknown Cage',
      stockingDate: cycle.startDate,
      expectedHarvestDate: cycle.endDate,
      expectedDuration,
      daysInCycle,
      currentStock,
      currentAvgWeight,
      currentBiomass,
      survivalRate,
      growthRate,
      totalMortality,
      totalFeedUsed,
      totalFeedCost,
      actualCosts,
      initialWeight: cycle.biomassStart && cycle.initialStock ? 
        cycle.biomassStart / cycle.initialStock : 0,
      initialBudget: 0, // Can be calculated from budgets relation if needed
      fcr: cycle.fcr ?? 0,
      status: cycle.status || 'active',
      species: cycle.species || '',
    };
  }

  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.cageId) where.cageId = filters.cageId;

    const [cycles, total] = await Promise.all([
      prisma.cycle.findMany({
        where,
        skip: offset,
        take: limit,
        include: { 
          cage: true, 
          dailyLogs: true, 
          harvests: true, 
          feedUsage: true,
          expenses: true,
          revenues: true,
          investments: {
            include: {
              investor: true
            }
          },
          payouts: {
            include: {
              investor: true
            }
          }
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.cycle.count({ where }),
    ]);

    const transformedCycles = cycles.map(cycle => this.transformCycle(cycle));

    return {
      data: transformedCycles,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const cycle = await prisma.cycle.findUnique({
      where: { id },
      include: { 
        cage: true, 
        dailyLogs: true, 
        harvests: true, 
        feedUsage: true,
        investments: {
          include: {
            investor: true
          }
        },
        payouts: {
          include: {
            investor: true
          }
        },
        expenses: true,
        revenues: true,
        waterLogs: true
      },
    });
    if (!cycle) throw new Error('Cycle not found');
    return this.transformCycle(cycle);
  }

  async create(data: any) {
    // Validate that cage exists
    const cage = await prisma.cage.findUnique({
      where: { id: data.cageId }
    });
    if (!cage) throw new Error('Cage not found');

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.expectedHarvestDate || data.endDate);
    if (!endDate || isNaN(endDate.getTime())) {
      // If no end date provided, calculate from expectedDuration
      const duration = parseInt(data.expectedDuration) || 120;
      endDate.setTime(startDate.getTime());
      endDate.setDate(endDate.getDate() + duration);
    }

    const initialStock = parseInt(data.initialStock) || 0;
    const initialWeight = parseFloat(data.initialWeight) || 0;
    const currentBiomass = initialStock * initialWeight;

    const cycle = await prisma.cycle.create({
      data: {
        cageId: data.cageId,
        startDate,
        endDate,
        species: data.species || cage.species,
        initialStock,
        status: data.status || 'active',
        biomassStart: currentBiomass,
      },
      include: { 
        cage: true, 
        dailyLogs: true, 
        harvests: true, 
        feedUsage: true,
        investments: {
          include: {
            investor: true
          }
        },
        payouts: {
          include: {
            investor: true
          }
        },
        expenses: true,
        revenues: true,
      },
    });
    
    // Update cage status and currentStock
    await prisma.cage.update({
      where: { id: data.cageId },
      data: {
        status: 'active',
        currentStock: initialStock,
      },
    });
    
    return this.transformCycle(cycle);
  }

  async update(id: string, data: any) {
    const cycle = await prisma.cycle.update({
      where: { id },
      data: {
        status: data.status,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        harvestedStock: data.harvestedStock,
        mortality: data.mortality,
        fcr: data.fcr,
        revenue: data.revenue,
        profit: data.profit,
        biomassEnd: data.biomassEnd,
      },
      include: { 
        cage: true, 
        dailyLogs: true, 
        harvests: true, 
        feedUsage: true,
        expenses: true,
        revenues: true,
        investments: {
          include: {
            investor: true
          }
        },
        payouts: {
          include: {
            investor: true
          }
        }
      },
    });
    
    return this.transformCycle(cycle);
  }

  async delete(id: string) {
    // Check for investments
    const investmentCount = await prisma.investment.count({
      where: { cycleId: id }
    });

    if (investmentCount > 0) {
      throw new Error(`Cannot delete cycle with ${investmentCount} investment(s). Financial records exist.`);
    }

    // Check for payouts
    const payoutCount = await prisma.payout.count({
      where: { cycleId: id }
    });

    if (payoutCount > 0) {
      throw new Error(`Cannot delete cycle with ${payoutCount} payout(s). Financial records exist.`);
    }

    return await prisma.cycle.delete({ where: { id } });
  }

  async addDailyLog(cycleId: string, data: any) {
    return await prisma.dailyLog.create({
      data: {
        cycleId,
        date: new Date(data.date),
        feedUsedKg: data.feedGiven,
        waterTemp: data.waterTemperature,
        notes: data.notes,
      },
    });
  }
  
  async getDailyLogs(cycleId: string) {
    return await prisma.dailyLog.findMany({
      where: { cycleId },
      orderBy: { date: 'desc' },
    });
  }

  async getStats(cycleId?: string) {
    if (cycleId) {
      // Get specific cycle stats
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
        include: { dailyLogs: true, harvests: true, feedUsage: true },
      });

      if (!cycle) throw new Error('Cycle not found');

      const totalFeedUsed = cycle.feedUsage.reduce((sum: number, f: any) => sum + (f.quantityKg || f.quantity || 0), 0);
      const totalMortality = cycle.mortality || 0;
      const harvestedQuantity = cycle.harvestedStock || 0;

      const fcr = totalFeedUsed > 0 && harvestedQuantity > 0 ? totalFeedUsed / harvestedQuantity : 0;
      const mortalityRate = cycle.initialStock && cycle.initialStock > 0 ? (totalMortality / cycle.initialStock) * 100 : 0;

      return {
        totalFeedUsed,
        totalMortality,
        mortalityRate,
        harvestedQuantity,
        fcr,
        dayCount: cycle.dailyLogs.length,
      };
    }
    
    // Get overall cycle statistics
    const [totalCycles, activeCycles, completedCycles] = await Promise.all([
      prisma.cycle.count(),
      prisma.cycle.count({ where: { status: 'active' } }),
      prisma.cycle.count({ where: { status: 'completed' } }),
    ]);

    const cycles = await prisma.cycle.findMany({
      include: { harvests: true, feedUsage: true },
    });

    const totalFeedUsed = cycles.reduce(
      (sum: number, c: any) => sum + c.feedUsage.reduce((s: number, f: any) => s + (f.quantityKg || f.quantity || 0), 0),
      0,
    );
    const totalHarvested = cycles.reduce(
      (sum: number, c: any) => sum + c.harvests.reduce((s: number, h: any) => s + (h.weightKg || 0), 0),
      0,
    );

    return {
      totalCycles,
      activeCycles,
      completedCycles,
      totalFeedUsed,
      totalHarvested,
      avgFeedPerCycle: cycles.length > 0 ? totalFeedUsed / cycles.length : 0,
    };
  }
}

export default new CycleService();


