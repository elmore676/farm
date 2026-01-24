import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface InvestmentByCycle {
  cycleId: string;
  cageCode: string;
  species: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  investmentAmount: number;
  payoutAmount: number;
  profit: number;
  roi: number;
}

export interface InvestmentBreakdown {
  investorId: string;
  investorName: string;
  totalInvestment: number;
  totalReturns: number;
  overallROI: number;
  investmentsByCycle: InvestmentByCycle[];
  yearlyBreakdown: {
    year: number;
    investment: number;
    returns: number;
    roi: number;
  }[];
  payoutStats: {
    pendingCount: number;
    paidCount: number;
    totalPending: number;
    totalPaid: number;
  };
}

export class InvestmentReportService {
  /**
   * Get investor's returns by cycle
   */
  async getInvestorReturnsByCycle(investorId: string): Promise<InvestmentByCycle[]> {
    const investments = await prisma.investment.findMany({
      where: { investorId },
      include: {
        cycle: {
          include: {
            cage: true,
            payouts: {
              where: { investorId },
            },
            revenues: true,
            expenses: true,
          },
        },
      },
    });

    return investments.map(inv => {
      const payoutAmount = inv.cycle?.payouts?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const revenue = inv.cycle?.revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
      const expenses = inv.cycle?.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const profit = payoutAmount - inv.amount;
      const roi = inv.amount > 0 ? (profit / inv.amount) * 100 : 0;

      return {
        cycleId: inv.cycleId || '',
        cageCode: inv.cycle?.cage?.code || 'N/A',
        species: inv.cycle?.species || 'Unknown',
        startDate: inv.cycle?.startDate || new Date(),
        endDate: inv.cycle?.endDate || null,
        status: inv.cycle?.status || 'unknown',
        investmentAmount: inv.amount,
        payoutAmount,
        profit,
        roi,
      };
    });
  }

  /**
   * Calculate detailed ROI for an investor
   */
  async calculateROI(investorId: string) {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: {
        investments: true,
        payouts: {
          include: { cycle: true },
        },
      },
    });

    if (!investor) {
      throw new Error('Investor not found');
    }

    const totalInvestment = investor.investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPayouts = investor.payouts.reduce((sum, p) => sum + p.amount, 0);
    const totalProfit = totalPayouts - totalInvestment;
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    // Calculate by cycle
    const investmentsByCycle = await this.getInvestorReturnsByCycle(investorId);

    // Calculate yearly breakdown
    const yearlyMap = new Map<number, { investment: number; returns: number }>();

    investor.investments.forEach(inv => {
      const year = inv.startDate.getFullYear();
      const current = yearlyMap.get(year) || { investment: 0, returns: 0 };
      current.investment += inv.amount;
      yearlyMap.set(year, current);
    });

    investor.payouts.forEach(p => {
      const year = p.createdAt.getFullYear();
      const current = yearlyMap.get(year) || { investment: 0, returns: 0 };
      current.returns += p.amount;
      yearlyMap.set(year, current);
    });

    const yearlyBreakdown = Array.from(yearlyMap.entries())
      .map(([year, data]) => ({
        year,
        investment: data.investment,
        returns: data.returns,
        roi: data.investment > 0 ? ((data.returns - data.investment) / data.investment) * 100 : 0,
      }))
      .sort((a, b) => a.year - b.year);

    // Payout statistics
    const payoutStats = {
      pendingCount: investor.payouts.filter(p => p.status === 'pending').length,
      paidCount: investor.payouts.filter(p => p.status === 'paid').length,
      totalPending: investor.payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0),
      totalPaid: investor.payouts
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0),
    };

    return {
      investorId,
      investorName: investor.name,
      totalInvestment,
      totalReturns: totalPayouts,
      overallROI: roi,
      investmentsByCycle,
      yearlyBreakdown,
      payoutStats,
    };
  }

  /**
   * Get complete investment breakdown for an investor
   */
  async getInvestmentBreakdown(investorId: string): Promise<InvestmentBreakdown> {
    return this.calculateROI(investorId) as any;
  }

  /**
   * Get comparative analysis across investors
   */
  async getComparativeAnalysis() {
    const investors = await prisma.investor.findMany({
      include: {
        investments: true,
        payouts: true,
      },
      orderBy: { totalReturns: 'desc' },
    });

    return investors.map(investor => ({
      investorId: investor.id,
      name: investor.name,
      totalInvestment: investor.totalInvestment,
      totalReturns: investor.totalReturns,
      roi: investor.roi,
      investmentCount: investor.investments.length,
      payoutCount: investor.payouts.length,
      avgPayoutSize: investor.payouts.length > 0 
        ? investor.payouts.reduce((sum, p) => sum + p.amount, 0) / investor.payouts.length 
        : 0,
    }));
  }

  /**
   * Get portfolio performance summary
   */
  async getPortfolioPerformance() {
    const allInvestors = await prisma.investor.findMany({
      include: {
        investments: true,
        payouts: true,
      },
    });

    const totalInvestment = allInvestors.reduce((sum, inv) => sum + inv.totalInvestment, 0);
    const totalReturns = allInvestors.reduce((sum, inv) => sum + inv.totalReturns, 0);
    const overallROI = totalInvestment > 0 ? ((totalReturns - totalInvestment) / totalInvestment) * 100 : 0;

    // Top performers
    const topPerformers = allInvestors
      .filter(inv => inv.totalInvestment > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5)
      .map(inv => ({
        investorId: inv.id,
        name: inv.name,
        roi: inv.roi,
        totalReturns: inv.totalReturns,
      }));

    // Top investors by amount
    const topByAmount = allInvestors
      .sort((a, b) => b.totalInvestment - a.totalInvestment)
      .slice(0, 5)
      .map(inv => ({
        investorId: inv.id,
        name: inv.name,
        totalInvestment: inv.totalInvestment,
        totalReturns: inv.totalReturns,
      }));

    return {
      totalInvestors: allInvestors.length,
      totalCapital: totalInvestment,
      totalReturns,
      overallROI,
      topPerformers,
      topByAmount,
      activeInvestors: allInvestors.filter(inv => inv.status === 'active').length,
    };
  }

  /**
   * Generate financial report for a cycle
   */
  async getCycleFinancialReport(cycleId: string) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        cage: true,
        investments: {
          include: { investor: true },
        },
        payouts: {
          include: { investor: true },
        },
        revenues: true,
        expenses: true,
      },
    });

    if (!cycle) {
      throw new Error('Cycle not found');
    }

    const totalRevenue = cycle.revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
    const totalExpenses = cycle.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const grossProfit = totalRevenue - totalExpenses;
    const totalInvestment = cycle.investments?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalPayouts = cycle.payouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const investorReturns = cycle.investments?.map(inv => ({
      investorId: inv.investorId,
      investorName: inv.investor.name,
      investment: inv.amount,
      sharePercentage: totalInvestment > 0 ? (inv.amount / totalInvestment) * 100 : 0,
      expectedPayout: (inv.amount / totalInvestment) * totalPayouts,
      actualPayout: cycle.payouts
        ?.filter(p => p.investorId === inv.investorId)
        .reduce((sum, p) => sum + p.amount, 0) || 0,
    })) || [];

    return {
      cycleId,
      cageName: cycle.cage.name,
      species: cycle.species,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
      financials: {
        totalRevenue,
        totalExpenses,
        grossProfit,
      },
      investments: {
        totalInvestment,
        investorCount: cycle.investments?.length || 0,
        investorReturns,
      },
      payouts: {
        totalPayouts,
        payoutCount: cycle.payouts?.length || 0,
        pendingPayouts: cycle.payouts?.filter(p => p.status === 'pending').length || 0,
        paidPayouts: cycle.payouts?.filter(p => p.status === 'paid').length || 0,
      },
    };
  }
}

export default new InvestmentReportService();
