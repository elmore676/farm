import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FinancialService {
  async getExpenses(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.category) where.category = filters.category;
    if (filters.cycleId) where.cycleId = filters.cycleId;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: offset,
        take: limit,
        include: { cycle: true },
        orderBy: { incurredAt: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRevenues(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.cycleId) where.cycleId = filters.cycleId;

    const [revenues, total] = await Promise.all([
      prisma.revenue.findMany({
        where,
        skip: offset,
        take: limit,
        include: { cycle: true },
        orderBy: { occurredAt: 'desc' },
      }),
      prisma.revenue.count({ where }),
    ]);

    return {
      data: revenues,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async addExpense(data: any) {
    return await prisma.expense.create({
      data: {
        cycleId: data.cycleId,
        cageId: data.cageId,
        category: data.category,
        description: data.description,
        amount: data.amount,
        incurredAt: new Date(data.incurredAt || data.date),
      },
      include: { cycle: true },
    });
  }

  async addRevenue(data: any) {
    return await prisma.revenue.create({
      data: {
        cycleId: data.cycleId,
        cageId: data.cageId,
        type: data.type || data.source,
        amount: data.amount,
        quantityKg: data.quantityKg,
        pricePerKg: data.pricePerKg,
        occurredAt: new Date(data.occurredAt || data.date),
      },
      include: { cycle: true },
    });
  }

  async getBudgetStatus(cycleId: string) {
    const [expenses, budgets] = await Promise.all([
      prisma.expense.findMany({ where: { cycleId } }),
      prisma.budgetAllocation.findMany({ where: { cycleId } }),
    ]);

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalBudget = budgets.reduce((sum, b) => sum + b.allocated, 0);

    const byCategory = new Map();
    expenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    });

    return {
      totalBudget,
      totalSpent: totalExpense,
      remaining: totalBudget - totalExpense,
      utilization: totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0,
      byCategory: Object.fromEntries(byCategory),
      budgets,
    };
  }

  async getProfitability(cycleId: string) {
    const [expenses, revenues] = await Promise.all([
      prisma.expense.findMany({ where: { cycleId } }),
      prisma.revenue.findMany({ where: { cycleId } }),
    ]);

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const profit = totalRevenue - totalExpense;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpense,
      profit,
      margin,
      expenses,
      revenues,
    };
  }

  async allocateBudget(data: any) {
    return await prisma.budgetAllocation.create({
      data: {
        cycleId: data.cycleId,
        cageId: data.cageId,
        category: data.category,
        allocated: data.allocated || data.allocatedAmount,
        spent: data.spent || 0,
      },
    });
  }
}

export default new FinancialService();
