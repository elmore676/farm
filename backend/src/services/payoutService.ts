import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PayoutCalculationInput {
  cycleId: string;
  harvestedStock: number;
  harvestWeight: number; // total kg harvested
  revenue: number; // total revenue from harvest
  farmExpenses: number; // actual farm operating costs
  harvestDate: string;
}

export interface InvestorPayoutBreakdown {
  investorId: string;
  investorName: string;
  sharePercentage: number;
  investmentAmount: number;
  revenueShare: number;
  profitShare: number;
  totalPayout: number;
  payoutBreakdown: {
    revenuePercentage: number;
    profitPercentage: number;
  };
}

export class PayoutService {
  /**
   * Create financial transaction records for payouts
   * Records revenue, expenses, and profit transactions
   */
  private async recordFinancialTransactions(
    cycleId: string,
    revenue: number,
    farmExpenses: number,
    harvestDate: string
  ) {
    try {
      // Record revenue transaction
      await prisma.transaction.create({
        data: {
          type: 'revenue',
          amount: revenue,
          description: `Harvest revenue for cycle`,
          reference: `HARVEST-REVENUE-${cycleId.substring(0, 8)}`,
          cycleId,
          transactionDate: new Date(harvestDate),
          notes: 'Recorded from cycle harvest',
        },
      });

      // Record expense transaction
      if (farmExpenses > 0) {
        await prisma.transaction.create({
          data: {
            type: 'expense',
            amount: farmExpenses,
            description: `Farm operating expenses for cycle`,
            reference: `HARVEST-EXPENSE-${cycleId.substring(0, 8)}`,
            cycleId,
            transactionDate: new Date(harvestDate),
            notes: 'Operating costs during cycle',
          },
        });
      }

      // Record profit/net income transaction
      const profit = revenue - farmExpenses;
      if (profit !== 0) {
        await prisma.transaction.create({
          data: {
            type: profit > 0 ? 'income' : 'loss',
            amount: Math.abs(profit),
            description: `Net ${profit > 0 ? 'profit' : 'loss'} from cycle`,
            reference: `HARVEST-PROFIT-${cycleId.substring(0, 8)}`,
            cycleId,
            transactionDate: new Date(harvestDate),
            notes: `Revenue - Expenses = ${profit}`,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to record financial transactions:', error);
      // Don't throw - allow payout to continue even if transaction recording fails
    }
  }

  /**
   * Record payout transactions in the finance module
   */
  private async recordPayoutTransaction(
    investorId: string,
    payoutId: string,
    amount: number,
    payoutReference: string,
    cycleId: string
  ) {
    try {
      const investor = await prisma.investor.findUnique({
        where: { id: investorId },
      });

      if (investor) {
        await prisma.transaction.create({
          data: {
            type: 'payout',
            amount,
            description: `Payout to investor for cycle`,
            reference: payoutReference,
            investorId,
            payoutId,
            cycleId,
            transactionDate: new Date(),
            notes: `Investor payout from harvest`,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to record payout transaction:', error);
    }
  }

  async getPayouts(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.investorId) where.investorId = filters.investorId;
    if (filters.status) where.status = filters.status;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip: offset,
        take: limit,
        include: { investor: true, cycle: { include: { cage: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payout.count({ where }),
    ]);

    return {
      data: payouts,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { investor: true, cycle: { include: { cage: true } } },
    });
    if (!payout) throw new Error('Payout not found');
    return payout;
  }

  async calculatePayout(investorId: string, cycleId: string) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { cage: true, harvests: true },
    });

    if (!cycle) throw new Error('Cycle not found');

    // Get all investments relevant to this cycle/cage
    const [allInvestments, investorInvestments] = await Promise.all([
      prisma.investment.findMany({
        where: { OR: [{ cycleId }, { cageId: cycle.cageId }] },
      }),
      prisma.investment.findMany({
        where: { investorId, OR: [{ cycleId }, { cageId: cycle.cageId }] },
      }),
    ]);

    if (investorInvestments.length === 0) {
      throw new Error('No matching investment allocation for this cycle');
    }

    const sumAmount = (inv: { amount?: number; shareUnits?: number; unitPrice?: number }) =>
      (inv.amount ?? ((inv.shareUnits ?? 0) * (inv.unitPrice ?? 0)));

    const totalCageInvestment = allInvestments.reduce((sum, i) => sum + sumAmount(i), 0);
    const investorTotal = investorInvestments.reduce((sum, i) => sum + sumAmount(i), 0);

    // Financials for this cycle
    const [revenues, expenses] = await Promise.all([
      prisma.revenue.findMany({ where: { cycleId } }),
      prisma.expense.findMany({ where: { cycleId } }),
    ]);

    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpense;

    const investorShare = totalCageInvestment > 0 ? (investorTotal / totalCageInvestment) : 0;
    const payoutAmount = Math.max(0, profit * investorShare * 0.7); // 70% of profit to investors

    return {
      investorId,
      cycleId,
      cageId: cycle.cageId,
      totalRevenue,
      totalExpense,
      profit,
      investorShare: (investorShare * 100).toFixed(2),
      payoutAmount,
      roiPercentage: investorTotal > 0 ? ((payoutAmount / investorTotal) * 100).toFixed(2) : '0.00',
      status: 'calculated',
    };
  }

  async recordPayout(data: any) {
    const calculation = await this.calculatePayout(data.investorId, data.cycleId);

    const payout = await prisma.payout.create({
      data: {
        investorId: data.investorId,
        cycleId: data.cycleId,
        amount: calculation.payoutAmount,
        status: 'pending',
        paidAt: null,
        reference: data.reference || null,
      },
      include: { investor: true, cycle: { include: { cage: true } } },
    });

    return payout;
  }

  async getPayoutHistory(investorId: string) {
    const payouts = await prisma.payout.findMany({
      where: { investorId },
      include: { cycle: { include: { cage: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const total = payouts.reduce((sum, p) => sum + p.amount, 0);
    const avgAmount = payouts.length > 0 ? total / payouts.length : 0;

    return {
      payouts,
      totalPayouts: payouts.length,
      totalAmount: total,
      averageAmount: avgAmount,
    };
  }

  async getPayoutsByCycle(cycleId: string) {
    const payouts = await prisma.payout.findMany({
      where: { cycleId },
      include: { investor: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = payouts.reduce((sum, p) => sum + p.amount, 0);
    const avgAmount = payouts.length > 0 ? total / payouts.length : 0;

    return {
      payouts,
      totalPayouts: payouts.length,
      totalAmount: total,
      averageAmount: avgAmount,
    };
  }

  /**
   * Get a specific payout by ID
   */
  async getPayoutById(payoutId: string) {
    return prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        investor: true,
        cycle: true,
      },
    });
  }

  /**
   * Calculate payout allocation for a harvested cycle
   * Based on: revenue, costs, and investor shares
   * 
   * Payout formula:
   * 1. Gross Profit = Revenue - Farm Operating Costs
   * 2. Investor Revenue Share = Revenue * Share % * REVENUE_ALLOCATION_RATIO
   * 3. Investor Profit Share = Gross Profit * Share % * PROFIT_ALLOCATION_RATIO
   * 4. Total Payout = Revenue Share + Profit Share
   */
  async calculatePayoutsForCycle(input: PayoutCalculationInput): Promise<InvestorPayoutBreakdown[]> {
    // Fetch cycle with investments
    const cycle = await prisma.cycle.findUnique({
      where: { id: input.cycleId },
      include: {
        cage: true,
        investments: {
          include: {
            investor: true,
          },
        },
        expenses: true,
      },
    });

    if (!cycle) {
      throw new Error('Cycle not found');
    }

    // Calculate gross profit
    const grossProfit = input.revenue - input.farmExpenses;

    // Calculate total investment (all investor shares in this cycle)
    const totalInvestment = cycle.investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    if (totalInvestment === 0) {
      return [];
    }

    // Payout allocation ratios (can be adjusted based on business model)
    // Example: 60% of profits go to revenue share, 40% to investor retention
    const REVENUE_ALLOCATION_RATIO = 0.6;
    const PROFIT_ALLOCATION_RATIO = 0.4;

    // Calculate payout for each investor
    const payouts: InvestorPayoutBreakdown[] = cycle.investments.map((investment) => {
      // Calculate investor's share percentage
      const sharePercentage = (investment.amount || 0) / totalInvestment;

      // Revenue share: investor gets a portion of total revenue based on their investment
      const revenueShare = input.revenue * sharePercentage * REVENUE_ALLOCATION_RATIO;

      // Profit share: investor gets a portion of gross profit based on their investment
      const profitShare = Math.max(0, grossProfit * sharePercentage * PROFIT_ALLOCATION_RATIO);

      // Total payout
      const totalPayout = revenueShare + profitShare;

      return {
        investorId: investment.investorId,
        investorName: investment.investor.name,
        sharePercentage: sharePercentage * 100,
        investmentAmount: investment.amount || 0,
        revenueShare,
        profitShare,
        totalPayout,
        payoutBreakdown: {
          revenuePercentage: REVENUE_ALLOCATION_RATIO * 100,
          profitPercentage: PROFIT_ALLOCATION_RATIO * 100,
        },
      };
    });

    return payouts;
  }

  /**
   * Create payout records in the database after harvest
   * This records the calculated payouts for each investor
   */
  async createPayoutsFromCalculation(
    cycleId: string,
    input: PayoutCalculationInput,
    payouts: InvestorPayoutBreakdown[]
  ) {
    const harvestDate = new Date(input.harvestDate);

    // Create payout records for each investor
    const createdPayouts = await Promise.all(
      payouts.map((payout) =>
        prisma.payout.create({
          data: {
            cycleId,
            investorId: payout.investorId,
            amount: payout.totalPayout,
            status: 'pending', // Will be manually approved before paying
            reference: `PAYOUT-${cycleId.substring(0, 8)}-${payout.investorId.substring(0, 8)}`,
            paidAt: null,
          },
          include: {
            investor: true,
            cycle: true,
          },
        })
      )
    );

    return createdPayouts;
  }

  /**
   * Initiate payouts for a harvested cycle
   * This is the main entry point that calculates and creates all payout records
   */
  async initiatePayoutsForHarvestedCycle(input: PayoutCalculationInput) {
    try {
      // Check if payouts already exist for this cycle
      const existingPayouts = await prisma.payout.findMany({
        where: { cycleId: input.cycleId },
      });

      if (existingPayouts.length > 0) {
        throw new Error('Payouts already initiated for this cycle');
      }

      // Calculate payouts
      const payouts = await this.calculatePayoutsForCycle(input);

      if (payouts.length === 0) {
        throw new Error('No investors found for this cycle');
      }

      // Create payout records
      const createdPayouts = await this.createPayoutsFromCalculation(input.cycleId, input, payouts);

      // Record financial transactions (revenue, expenses, profit)
      await this.recordFinancialTransactions(
        input.cycleId,
        input.revenue,
        input.farmExpenses,
        input.harvestDate
      );

      // Record payout transactions in finance module
      for (const payout of payouts) {
        const createdPayout = createdPayouts.find(p => p.investorId === payout.investorId);
        if (createdPayout) {
          await this.recordPayoutTransaction(
            payout.investorId,
            createdPayout.id,
            payout.totalPayout,
            `PAYOUT-${input.cycleId.substring(0, 8)}-${payout.investorId.substring(0, 8)}`,
            input.cycleId
          );
        }
      }

      // Update cycle with payout information
      await prisma.cycle.update({
        where: { id: input.cycleId },
        data: {
          status: 'completed',
          revenue: input.revenue,
        },
      });

      // Update investor totals and ROI
      for (const payout of payouts) {
        const investor = await prisma.investor.findUnique({
          where: { id: payout.investorId },
        });

        if (investor) {
          const newTotalReturns = (investor.totalReturns || 0) + payout.totalPayout;
          const roiPercentage = investor.totalInvestment > 0 ? (newTotalReturns / investor.totalInvestment) * 100 : 0;

          await prisma.investor.update({
            where: { id: payout.investorId },
            data: {
              totalReturns: newTotalReturns,
              roi: roiPercentage,
            },
          });
        }
      }

      return {
        success: true,
        cycleId: input.cycleId,
        payouts,
        createdPayouts,
        totalPayoutAmount: payouts.reduce((sum, p) => sum + p.totalPayout, 0),
      };
    } catch (error) {
      throw new Error(`Failed to initiate payouts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending payouts that need approval/processing
   */
  async getPendingPayouts() {
    return prisma.payout.findMany({
      where: { status: 'pending' },
      include: {
        investor: true,
        cycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get payouts for a specific investor
   */
  async getInvestorPayouts(investorId: string, status?: string) {
    const where: any = { investorId };
    if (status) where.status = status;

    return prisma.payout.findMany({
      where,
      include: {
        cycle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve a payout (mark as approved before payment)
   */
  async approvePayout(payoutId: string) {
    return prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'processing' },
      include: {
        investor: true,
        cycle: true,
      },
    });
  }

  /**
   * Process/Complete a payout (after payment is made)
   */
  async processPayout(payoutId: string, paymentRef?: string) {
    return prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        reference: paymentRef || undefined,
      },
      include: {
        investor: true,
        cycle: true,
      },
    });
  }

  /**
   * Reject a payout
   */
  async rejectPayout(payoutId: string) {
    return prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'failed',
      },
    });
  }

  /**
   * Get payout summary statistics
   */
  async getPayoutSummary() {
    const totalPayouts = await prisma.payout.aggregate({
      _sum: { amount: true },
      _count: true,
    });

    const pendingPayouts = await prisma.payout.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
      _count: true,
    });

    const paidPayouts = await prisma.payout.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
      _count: true,
    });

    return {
      totalPayouts: {
        count: totalPayouts._count,
        amount: totalPayouts._sum.amount || 0,
      },
      pendingPayouts: {
        count: pendingPayouts._count,
        amount: pendingPayouts._sum.amount || 0,
      },
      paidPayouts: {
        count: paidPayouts._count,
        amount: paidPayouts._sum.amount || 0,
      },
    };
  }

  /**
   * Calculate estimated payouts for an active cycle
   * (useful for showing investors their potential returns)
   */
  async estimatePayoutsForActiveCycle(cycleId: string, projectedRevenue: number, projectedExpenses: number) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        investments: {
          include: {
            investor: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new Error('Cycle not found');
    }

    // Use the same calculation logic with projected values
    const input: PayoutCalculationInput = {
      cycleId,
      harvestedStock: cycle.harvestedStock || cycle.initialStock || 0,
      harvestWeight: 0, // Not needed for estimation
      revenue: projectedRevenue,
      farmExpenses: projectedExpenses,
      harvestDate: new Date().toISOString(),
    };

    return this.calculatePayoutsForCycle(input);
  }
}

export default new PayoutService();
