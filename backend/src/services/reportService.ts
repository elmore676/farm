import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportService {
  async getReports(filters: any = {}, pagination: any = {}) {
    // Reports are generated on-demand, not stored
    // This returns summary of recent cycles and financials that could be reported
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const cycles = await prisma.cycle.findMany({
      skip: offset,
      take: limit,
      include: { cage: true },
      orderBy: { endDate: 'desc' },
    });

    return {
      data: cycles.map((c) => ({
        id: c.id,
        type: 'cycle',
        title: `Production Report - Cycle ${c.id}`,
        cageId: c.cageId,
        startDate: c.startDate,
        endDate: c.endDate,
        createdAt: c.createdAt,
      })),
      pagination: { total: cycles.length, page, limit },
    };
  }

  async getById(id: string) {
    const cycle = await prisma.cycle.findUnique({
      where: { id },
      include: { cage: true, dailyLogs: true, harvests: true },
    });
    if (!cycle) throw new Error('Cycle not found');
    return cycle;
  }

  async generateCycleReport(cycleId: string) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        cage: true,
        dailyLogs: true,
        harvests: true,
        expenses: true,
        revenues: true,
      },
    });

    if (!cycle) throw new Error('Cycle not found');

    const totalFeed = cycle.dailyLogs.reduce((sum: number, log: any) => sum + (log.feedQuantity || 0), 0);
    const totalMortality = cycle.dailyLogs.reduce((sum: number, log: any) => sum + (log.observedMortality || 0), 0);
    const mortalityRate = cycle.initialStock && cycle.initialStock > 0 ? (totalMortality / cycle.initialStock) * 100 : 0;
    const harvestedQuantity = cycle.harvests?.[0]?.weightKg || 0;
    const fcr = totalFeed > 0 && harvestedQuantity > 0 ? totalFeed / harvestedQuantity : 0;

    const totalRevenue = cycle.revenues.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalExpense = cycle.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpense;

    const avgTemp = cycle.dailyLogs.length > 0
      ? cycle.dailyLogs.reduce((sum: number, log: any) => sum + (log.waterTemperature || 0), 0) / cycle.dailyLogs.length
      : 0;

    const reportData = {
      id: cycleId,
      type: 'cycle',
      title: `Production Report - ${cycle.cage?.name} (${cycle.species})`,
      content: {
        cycle: {
          id: cycle.id,
          cage: cycle.cage?.name,
          species: cycle.species,
          startDate: cycle.startDate,
          endDate: cycle.endDate || new Date(),
          duration: cycle.endDate
            ? Math.ceil((cycle.endDate.getTime() - cycle.startDate.getTime()) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date().getTime() - cycle.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        },
        production: {
          initialStock: cycle.initialStock,
          harvested: harvestedQuantity,
          mortality: totalMortality,
          mortalityRate: mortalityRate.toFixed(2),
        },
        feedManagement: {
          totalFeedUsed: totalFeed,
          fcr: fcr.toFixed(2),
        },
        waterQuality: {
          averageTemperature: avgTemp.toFixed(2),
          recordCount: cycle.dailyLogs.length,
        },
        financial: {
          totalRevenue,
          totalExpense,
          profit,
          profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : '0',
        },
      },
      generatedAt: new Date(),
    };

    return reportData;
  }

  async generateFinancialReport(startDate: Date, endDate: Date) {
    const expenses = await prisma.expense.findMany({
      where: {
        incurredAt: { gte: startDate, lte: endDate },
      },
    });

    const revenues = await prisma.revenue.findMany({
      where: {
        occurredAt: { gte: startDate, lte: endDate },
      },
    });

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const profit = totalRevenue - totalExpense;

    const byCategory = new Map();
    expenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    });

    const reportData = {
      type: 'financial',
      title: `Financial Report (${startDate.toDateString()} - ${endDate.toDateString()})`,
      content: {
        period: { startDate, endDate },
        summary: {
          totalRevenue,
          totalExpense,
          profit,
          profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : '0',
        },
        expenseByCategory: Object.fromEntries(byCategory),
        transactionCount: expenses.length + revenues.length,
      },
      generatedAt: new Date(),
    };

    return reportData;
  }

  async generateInvestorReport(investorId: string) {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: { investments: true, payouts: true },
    });

    if (!investor) throw new Error('Investor not found');

    const totalInvested = investor.investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPayouts = investor.payouts.reduce((sum, p) => sum + p.amount, 0);

    const reportData = {
      type: 'investor',
      title: `Investment Portfolio Report - ${investor.name}`,
      content: {
        investor: {
          id: investor.id,
          name: investor.name,
          email: investor.email,
          phone: investor.phone,
          status: investor.status,
        },
        investments: {
          total: investor.investments.length,
          totalAmount: totalInvested,
          active: investor.investments.filter((i: any) => i.status === 'active').length,
        },
        returns: {
          totalPayouts,
          roi: totalInvested > 0 ? ((totalPayouts / totalInvested) * 100).toFixed(2) : '0',
          payoutCount: investor.payouts.length,
        },
      },
      generatedAt: new Date(),
    };

    return reportData;
  }
}

export default new ReportService();
