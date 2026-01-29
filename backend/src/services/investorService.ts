import prisma from '../lib/prisma';

export class InvestorService {
  async getAll(filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [investors, total] = await Promise.all([
      prisma.investor.findMany({
        where,
        skip: offset,
        take: limit,
        include: { 
          investments: { include: { cage: true } },
          payouts: true 
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investor.count({ where }),
    ]);

    return {
      data: investors,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const investor = await prisma.investor.findUnique({
      where: { id },
      include: { investments: { include: { cage: true } }, payouts: true },
    });
    if (!investor) throw new Error('Investor not found');
    return investor;
  }

  async create(data: any) {
    return await prisma.investor.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        idNumber: data.idNumber,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        status: data.status || 'active',
        kycStatus: data.kycStatus || 'pending',
      },
      include: { investments: true, payouts: true },
    });
  }

  async update(id: string, data: any) {
    return await prisma.investor.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        idNumber: data.idNumber,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        status: data.status,
        kycStatus: data.kycStatus,
      },
      include: { investments: true, payouts: true },
    });
  }

  async delete(id: string) {
    // Check for related investments
    const investmentCount = await prisma.investment.count({
      where: { investorId: id }
    });

    if (investmentCount > 0) {
      throw new Error(`Cannot delete investor with ${investmentCount} active investment(s). Please remove investments first.`);
    }

    // Check for related payouts
    const payoutCount = await prisma.payout.count({
      where: { investorId: id }
    });

    if (payoutCount > 0) {
      throw new Error(`Cannot delete investor with ${payoutCount} payout record(s). Please archive instead of deleting.`);
    }

    return await prisma.investor.delete({ where: { id } });
  }

  async getStats() {
    const [totalInvestors, activeInvestors, totalInvested] = await Promise.all([
      prisma.investor.count(),
      prisma.investor.count({ where: { status: 'active' } }),
      prisma.investment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    return {
      totalInvestors,
      activeInvestors,
      totalInvested: totalInvested._sum.amount || 0,
    };
  }

  /**
   * Recalculate investor totals and ROI based on their payouts
   * Called after payouts are created/updated
   */
  async recalculateInvestorMetrics(investorId: string) {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: {
        investments: true,
        payouts: true,
      },
    });

    if (!investor) {
      throw new Error('Investor not found');
    }

    // Calculate total investment
    const totalInvestment = investor.investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // Calculate total returns from payouts
    const totalReturns = investor.payouts.reduce((sum, payout) => sum + (payout.amount || 0), 0);

    // Calculate ROI percentage
    const roi = totalInvestment > 0 ? (totalReturns / totalInvestment) * 100 : 0;

    // Persist calculated metrics to database
    return await prisma.investor.update({
      where: { id: investorId },
      data: {
        totalInvestment,
        totalReturns,
        roi,
      },
      include: {
        investments: true,
        payouts: true,
      },
    });
  }

  /**
   * Get investor's payout summary
   */
  async getPayoutSummary(investorId: string) {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: {
        payouts: {
          include: { cycle: true },
          orderBy: { createdAt: 'desc' },
        },
        investments: true,
      },
    });

    if (!investor) {
      throw new Error('Investor not found');
    }

    const totalPayouts = investor.payouts.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayouts = investor.payouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    const paidPayouts = investor.payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    const processingPayouts = investor.payouts
      .filter(p => p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      investorId,
      investorName: investor.name,
      totalInvestment: investor.totalInvestment,
      totalReturns: investor.totalReturns,
      roi: investor.roi,
      payoutSummary: {
        totalPayouts,
        pendingPayouts,
        processingPayouts,
        paidPayouts,
        failedPayouts: totalPayouts - pendingPayouts - processingPayouts - paidPayouts,
        payoutCount: investor.payouts.length,
        averagePayout: investor.payouts.length > 0 ? totalPayouts / investor.payouts.length : 0,
      },
      recentPayouts: investor.payouts.slice(0, 10),
    };
  }
}

export default new InvestorService();
