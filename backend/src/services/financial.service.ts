import Decimal from 'decimal.js';
import { PayoutStatus, CycleStatus, ExpenseCategory } from '@prisma/client';
import prisma from '../lib/prisma';

// Helper interfaces for pure calculations (used by unit tests)
export interface InvestorShare {
  investorId: string;
  investorName?: string;
  units: Decimal;
}

export interface PayoutBreakdown {
  investorId: string;
  investorName?: string;
  gross: Decimal;
  tax: Decimal;
  net: Decimal;
}

export interface ProfitLossInput {
  revenues: Decimal[];
  directCosts: Decimal[];
  indirectCosts: Decimal[];
}

export interface ProfitLossResult {
  revenue: Decimal;
  directCosts: Decimal;
  indirectCosts: Decimal;
  grossProfit: Decimal;
  netProfit: Decimal;
  profitMargin: Decimal;
}

// Prisma client for data access
// After schema regeneration, we can use strongly typed enums and models directly.

/** Round to 2 dp using bankers rounding */
export const round2 = (v: Decimal.Value) => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const computeProportionalPayouts = (
  profit: Decimal.Value,
  shares: InvestorShare[],
  taxRatePct = 0,
): PayoutBreakdown[] => {
  const profitDec = new Decimal(profit);
  const totalUnits = shares.reduce((acc, s) => acc.plus(s.units), new Decimal(0));
  if (totalUnits.isZero()) return [];

  return shares.map((s) => {
    const gross = profitDec.mul(s.units).div(totalUnits);
    const tax = gross.mul(taxRatePct).div(100);
    const net = gross.minus(tax);
    return {
      investorId: s.investorId,
      investorName: s.investorName,
      gross: round2(gross),
      tax: round2(tax),
      net: round2(net),
    };
  });
};

export const computeProfitLoss = (input: ProfitLossInput): ProfitLossResult => {
  const revenue = input.revenues.reduce((a, b) => a.plus(b), new Decimal(0));
  const directCosts = input.directCosts.reduce((a, b) => a.plus(b), new Decimal(0));
  const indirectCosts = input.indirectCosts.reduce((a, b) => a.plus(b), new Decimal(0));
  const grossProfit = revenue.minus(directCosts);
  const netProfit = grossProfit.minus(indirectCosts);
  const profitMargin = revenue.isZero() ? new Decimal(0) : netProfit.div(revenue).mul(100);
  return {
    revenue: round2(revenue),
    directCosts: round2(directCosts),
    indirectCosts: round2(indirectCosts),
    grossProfit: round2(grossProfit),
    netProfit: round2(netProfit),
    profitMargin: round2(profitMargin),
  };
};

export const computeROI = (
  totalInvestment: Decimal.Value,
  totalReturns: Decimal.Value,
): { roiPct: Decimal; } => {
  const invest = new Decimal(totalInvestment);
  const ret = new Decimal(totalReturns);
  const roi = invest.isZero() ? new Decimal(0) : ret.minus(invest).div(invest).mul(100);
  return { roiPct: round2(roi) };
};

export const annualizeReturn = (roiPct: Decimal.Value, daysHeld: number): Decimal => {
  if (daysHeld <= 0) return round2(roiPct);
  const daily = new Decimal(roiPct).div(100).plus(1).pow(new Decimal(365).div(daysHeld)).minus(1).mul(100);
  return round2(daily);
};

export const computeForecastFromCycles = (
  cycles: Array<{ biomassEnd?: number | null; fcr?: number | null; profit?: number | null }>,
) => {
  if (!cycles.length) return null;
  const avgGrowthRate = new Decimal(cycles.map((c) => c.biomassEnd ?? 0).reduce((a, b) => a + b, 0)).div(cycles.length || 1);
  const avgFcr = new Decimal(cycles.map((c) => c.fcr ?? 0).reduce((a, b) => a + b, 0)).div(cycles.length || 1);
  const avgProfit = new Decimal(cycles.map((c) => c.profit ?? 0).reduce((a, b) => a + b, 0)).div(cycles.length || 1);

  const forecastRevenue = avgProfit.abs().mul(1.15);
  const forecastExpense = forecastRevenue.div(avgFcr.isZero() ? 1 : avgFcr).mul(0.6);
  const profit = forecastRevenue.minus(forecastExpense);

  return {
    forecastRevenue: round2(forecastRevenue),
    forecastExpense: round2(forecastExpense),
    forecastProfit: round2(profit),
    confidenceInterval: {
      lower: round2(profit.mul(0.85)),
      upper: round2(profit.mul(1.15)),
    },
    assumptions: { avgGrowthRate: round2(avgGrowthRate), avgFcr: round2(avgFcr), avgProfit: round2(avgProfit) },
  };
};

export const computeBudgetVariance = (
  budgets: Array<{ category: ExpenseCategory; allocated: number; spent: number }>,
) => {
  const variance = budgets.map((b) => ({
    category: b.category,
    allocated: round2(b.allocated),
    spent: round2(b.spent),
    variance: round2(new Decimal(b.spent).minus(b.allocated)),
  }));
  const overspent = variance.filter((v) => v.variance.greaterThan(0));
  return { variance, overspent };
};

export const computeFeedCostAnalysis = (
  feedUsage: Array<{ feedType: string; quantityKg: number }>,
  feedStocks: Array<{ feedType: string; costPerKg: number }>,
) => {
  const feedCostByType: Record<string, Decimal> = {};
  feedStocks.forEach((s) => {
    feedCostByType[s.feedType] = (feedCostByType[s.feedType] || new Decimal(0)).plus(new Decimal(s.costPerKg || 0));
  });

  const feedQtyByType: Record<string, Decimal> = {};
  feedUsage.forEach((u) => {
    feedQtyByType[u.feedType] = (feedQtyByType[u.feedType] || new Decimal(0)).plus(new Decimal(u.quantityKg));
  });

  const feedCostPerKg: Record<string, Decimal> = {};
  Object.keys(feedQtyByType).forEach((t) => {
    const avgCost = feedCostByType[t] ? feedCostByType[t].div(feedStocks.filter((s) => s.feedType === t).length || 1) : new Decimal(0);
    feedCostPerKg[t] = round2(avgCost);
  });

  const totalFeedUsed = Object.values(feedQtyByType).reduce((a, b) => a.plus(b), new Decimal(0));
  const totalFeedCost = Object.entries(feedQtyByType).reduce((acc, [t, qty]) => acc.plus(qty.mul(feedCostPerKg[t] || 0)), new Decimal(0));

  return {
    totalFeedUsedKg: round2(totalFeedUsed),
    estimatedFeedCost: round2(totalFeedCost),
    feedCostPerType: Object.entries(feedCostPerKg).map(([t, cost]) => ({ feedType: t, avgCostPerKg: cost })),
  };
};

export class FinancialService {
  /** Payout calculation and persistence */
  async calculatePayoutsForCycle(cycleId: string, taxRatePct = 0) {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        cage: true,
        harvests: true,
      },
    });
    if (!cycle) throw new Error('Cycle not found');

    const investments = await prisma.investment.findMany({ where: { cageId: cycle.cageId }, include: { investor: true } });

    // Profit estimation: use cycle.profit if present, else compute from revenue table minus expenses
    const revenueSum = await prisma.revenue.aggregate({ _sum: { amount: true }, where: { cycleId } });
    const expenseSum = await prisma.expense.aggregate({ _sum: { amount: true }, where: { cycleId } });
    const profit = cycle.profit ?? (revenueSum._sum.amount ?? 0) - (expenseSum._sum.amount ?? 0);
    const profitDec = new Decimal(profit);

    const shares: InvestorShare[] = investments.map((inv) => ({
      investorId: inv.investorId,
      investorName: inv.investor?.name,
      units: new Decimal(inv.shareUnits ?? 1),
    }));

    const breakdown = computeProportionalPayouts(profitDec, shares, taxRatePct);

    // Create payout records & log
    const created = await prisma.$transaction(
      breakdown.map((b) =>
        prisma.payout.create({
          data: {
            investorId: b.investorId,
            cycleId,
            amount: b.net.toNumber(),
            status: PayoutStatus.processing,
            reference: `AUTO-${cycleId}`,
          },
        }),
      ),
    );

    await prisma.financialLog.create({
      data: {
        type: 'payout_distribution',
        entityId: cycleId,
        entityType: 'cycle',
        amount: profitDec.toNumber(),
        metadata: { taxRatePct, payouts: breakdown.map((b) => ({ investorId: b.investorId, net: b.net.toNumber() })) },
      },
    });

    return { cycleId, taxRatePct, profit: round2(profitDec), payouts: breakdown, createdCount: created.length };
  }

  /** ROI calculation per investor */
  async calculateROI(investorId: string, startDate?: string, endDate?: string) {
    const investments = await prisma.investment.findMany({
      where: { investorId, startDate: startDate ? { gte: new Date(startDate) } : undefined, endDate: endDate ? { lte: new Date(endDate) } : undefined },
    });
    const payouts = await prisma.payout.findMany({
      where: { investorId, paidAt: startDate || endDate ? {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      } : undefined },
    });

    const totalInvestment = investments.reduce((acc, inv) => acc.plus(inv.amount), new Decimal(0));
    const totalReturns = payouts.reduce((acc, p) => acc.plus(p.amount), new Decimal(0));

    const { roiPct } = computeROI(totalInvestment, totalReturns);

    // Approximate holding days: min start to max end/now
    const minDate = investments.reduce<Date | null>((acc, inv) => (!acc || inv.startDate < acc ? inv.startDate : acc), null);
    const maxDate = payouts.reduce<Date | null>((acc, p) => (!acc || (p.paidAt ?? p.createdAt) > acc ? (p.paidAt ?? p.createdAt) : acc), null);
    const daysHeld = minDate && maxDate ? Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000)) : 365;
    const annualized = annualizeReturn(roiPct, daysHeld);

    // Per-cage ROI breakdown (using payouts linked to cycles)
    const payoutByCycle = await prisma.payout.groupBy({ by: ['cycleId'], _sum: { amount: true }, where: { investorId } });
    const cycles = await prisma.cycle.findMany({ where: { id: { in: payoutByCycle.map((p) => p.cycleId).filter(Boolean) as string[] } }, include: { cage: true } });
    const perCage = payoutByCycle.map((p) => {
      const c = cycles.find((c) => c.id === p.cycleId);
      return { cageId: c?.cageId, cageName: c?.cage?.name, cycleId: p.cycleId, returns: p._sum.amount ?? 0 };
    });

    await prisma.financialLog.create({
      data: {
        type: 'roi_calculation',
        entityId: investorId,
        entityType: 'investor',
        metadata: { roiPct: roiPct.toNumber(), annualized: annualized.toNumber() },
      },
    });

    return {
      investorId,
      totalInvestment: round2(totalInvestment),
      totalReturns: round2(totalReturns),
      roiPct,
      annualizedRoiPct: annualized,
      daysHeld,
      perCage,
    };
  }

  /** Profit & Loss for cage or cycle */
  async profitAndLoss(params: { cageId?: string; cycleId?: string; start?: string; end?: string }) {
    const whereRevenue: any = { cageId: params.cageId, cycleId: params.cycleId };
    const whereExpense: any = { cageId: params.cageId, cycleId: params.cycleId };
    if (params.start || params.end) {
      whereRevenue.occurredAt = { gte: params.start ? new Date(params.start) : undefined, lte: params.end ? new Date(params.end) : undefined };
      whereExpense.incurredAt = { gte: params.start ? new Date(params.start) : undefined, lte: params.end ? new Date(params.end) : undefined };
    }

    const revenues = await prisma.revenue.findMany({ where: whereRevenue });
    const expenses = await prisma.expense.findMany({ where: whereExpense });

    const directCategories: ExpenseCategory[] = [ExpenseCategory.fingerlings, ExpenseCategory.feed, ExpenseCategory.labor, ExpenseCategory.maintenance, ExpenseCategory.utilities];
    const direct = expenses.filter((e) => directCategories.includes(e.category));
    const indirect = expenses.filter((e) => !direct.includes(e));

    const result = computeProfitLoss({
      revenues: revenues.map((r) => new Decimal(r.amount)),
      directCosts: direct.map((e) => new Decimal(e.amount)),
      indirectCosts: indirect.map((e) => new Decimal(e.amount)),
    });

    return {
      ...result,
      revenueStreams: revenues.map((r) => ({ id: r.id, type: r.type, amount: round2(r.amount) })),
      expenseBreakdown: expenses.map((e) => ({ id: e.id, category: e.category, amount: round2(e.amount) })),
    };
  }

  /** Forecast next cycle using simple averages */
  async forecastCycle(cageId: string) {
    const cycles = await prisma.cycle.findMany({ where: { cageId, status: CycleStatus.completed }, take: 6, orderBy: { endDate: 'desc' }, include: { harvests: true } });
    if (!cycles.length) return { cageId, message: 'No historical cycles' };

    const computed = computeForecastFromCycles(cycles);
    if (!computed) return { cageId, message: 'No historical cycles' };

    return { cageId, ...computed };
  }

  /** Cost analysis */
  async costAnalysis(cageId?: string) {
    const feedUsage = await prisma.feedUsage.findMany({ where: { cageId }, orderBy: { date: 'desc' }, take: 500 });
    const feedStocks = await prisma.feedStock.findMany({});
    const computed = computeFeedCostAnalysis(
      feedUsage.map((u) => ({ feedType: u.feedType, quantityKg: u.quantityKg })),
      feedStocks.map((s) => ({ feedType: s.feedType, costPerKg: s.costPerKg })),
    );

    return { cageId, ...computed };
  }

  /** Budget variance and overspending alerts */
  async budgetVariance(cycleId: string) {
    const budgets = await prisma.budgetAllocation.findMany({ where: { cycleId } });
    if (!budgets.length) return { cycleId, message: 'No budget set' };
    const computed = computeBudgetVariance(budgets.map((b) => ({ category: b.category, allocated: b.allocated, spent: b.spent })));
    return { cycleId, ...computed };
  }
}

export const financialService = new FinancialService();
