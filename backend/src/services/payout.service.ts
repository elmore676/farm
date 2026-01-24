import { PrismaClient, Payout, PayoutStatus } from '@prisma/client';
import { ApiError } from '../utils/apiError';

const prisma = new PrismaClient();

// Helper to map to frontend
const mapPayout = (p: Payout & { cycle?: { id: string; cageId: string; cage: { name: string } | null } | null }) => ({
    id: p.id,
    investorId: p.investorId,
    cageId: p.cycle?.cageId ?? null,
    cageName: p.cycle?.cage?.name ?? null,
    cycleId: p.cycleId,
    amount: p.amount,
    date: p.paidAt || p.createdAt,
    status: p.status,
    reference: p.reference ?? undefined,
});

export const payoutService = {
    async list(filters: { investorId?: string; cycleId?: string }) {
        const payouts = await prisma.payout.findMany({
            where: {
                investorId: filters.investorId,
                cycleId: filters.cycleId,
            },
            orderBy: { createdAt: 'desc' },
            include: { cycle: { select: { id: true, cageId: true, cage: { select: { name: true } } } } },
        });
        return payouts.map(mapPayout);
    },

    async process(data: { investorId: string; cycleId?: string; amount: number; reference?: string }) {
        // Validate investor
        const investor = await prisma.investor.findUnique({ where: { id: data.investorId } });
        if (!investor) throw new ApiError(404, 'Investor not found');

        // Create payout
        const payout = await prisma.payout.create({
            data: {
                investorId: data.investorId,
                cycleId: data.cycleId,
                amount: data.amount,
                status: 'processing' as PayoutStatus,
                reference: data.reference,
            },
            include: { cycle: { select: { id: true, cageId: true, cage: { select: { name: true } } } } },
        });
        return mapPayout(payout);
    },

    calculate(data: { amount: number; rate?: number; fees?: number }) {
        const { amount, rate = 1, fees = 0 } = data;
        if (amount <= 0) throw new ApiError(400, 'Amount must be greater than 0');
        if (rate <= 0) throw new ApiError(400, 'Rate must be greater than 0');
        const netAmount = Math.max(amount * rate - fees, 0);
        return { grossAmount: amount, rate, fees, netAmount };
    },
};
