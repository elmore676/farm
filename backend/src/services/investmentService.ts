import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InvestmentService {
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.investorId) where.investorId = filters.investorId;
    if (filters.cageId) where.cageId = filters.cageId;
    if (filters.cycleId) where.cycleId = filters.cycleId;
    if (filters.status) where.status = filters.status;

    const [investments, total] = await Promise.all([
      prisma.investment.findMany({
        where,
        skip: offset,
        take: limit,
        include: { 
          investor: true, 
          cage: true,
          cycle: {
            include: {
              cage: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investment.count({ where }),
    ]);

    return {
      data: investments,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const investment = await prisma.investment.findUnique({
      where: { id },
      include: { 
        investor: true, 
        cage: true,
        cycle: {
          include: {
            cage: true
          }
        }
      },
    });
    if (!investment) throw new Error('Investment not found');
    return investment;
  }

  async create(data: any) {
    // Validate that investor exists
    const investor = await prisma.investor.findUnique({
      where: { id: data.investorId }
    });
    if (!investor) throw new Error('Investor not found');

    // Validate that cycle exists if provided
    if (data.cycleId) {
      const cycle = await prisma.cycle.findUnique({
        where: { id: data.cycleId }
      });
      if (!cycle) throw new Error('Cycle not found');
    }

    // Validate that cage exists if provided
    if (data.cageId) {
      const cage = await prisma.cage.findUnique({
        where: { id: data.cageId }
      });
      if (!cage) throw new Error('Cage not found');
    }

    const investment = await prisma.investment.create({
      data: {
        investorId: data.investorId,
        cycleId: data.cycleId || null,
        cageId: data.cageId || null,
        amount: data.amount,
        shareUnits: data.shareUnits || 1,
        unitPrice: data.unitPrice || 0,
        roiPercent: data.roiPercent || 0,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status || 'active',
      },
      include: { 
        investor: true, 
        cage: true,
        cycle: {
          include: {
            cage: true
          }
        }
      },
    });

    return investment;
  }

  async update(id: string, data: any) {
    return await prisma.investment.update({
      where: { id },
      data: {
        cycleId: data.cycleId !== undefined ? data.cycleId : undefined,
        roiPercent: data.roiPercent,
        status: data.status,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: { 
        investor: true, 
        cage: true,
        cycle: {
          include: {
            cage: true
          }
        }
      },
    });
  }

  async delete(id: string) {
    return await prisma.investment.delete({ where: { id } });
  }

  async getByInvestor(investorId: string) {
    return await prisma.investment.findMany({
      where: { investorId },
      include: { 
        cage: true,
        cycle: {
          include: {
            cage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByCage(cageId: string) {
    return await prisma.investment.findMany({
      where: { cageId },
      include: { 
        investor: true,
        cycle: true
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByCycle(cycleId: string) {
    return await prisma.investment.findMany({
      where: { cycleId },
      include: { 
        investor: true,
        cage: true
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCageInvestmentStats(cageId: string) {
    const investments = await prisma.investment.findMany({ where: { cageId } });

    const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
    const investorCount = new Set(investments.map((i) => i.investorId)).size;

    return {
      cageId,
      totalInvested,
      investorCount,
      investmentCount: investments.length,
      investments,
    };
  }

  async getInvestorInvestments(investorId: string) {
    const investments = await prisma.investment.findMany({
      where: { investorId },
      include: { cage: true },
    });

    const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
    const activeCount = investments.filter((i) => i.status === 'active').length;

    return {
      investorId,
      totalInvested,
      activeInvestments: activeCount,
      totalInvestments: investments.length,
      investments,
    };
  }
}

export default new InvestmentService();
