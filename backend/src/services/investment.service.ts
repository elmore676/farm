import { PrismaClient, Investment } from '@prisma/client';
import { ApiError } from '../utils/apiError';

const prisma = new PrismaClient();

// Helper to map to frontend using real stored values
const mapInvestment = (inv: Investment & { cage?: { name: string } | null }) => ({
    id: inv.id,
    investorId: inv.investorId,
    cageId: inv.cageId,
    cageName: inv.cage?.name,
    investmentCode: inv.id,
    shareUnits: inv.shareUnits ?? 1,
    unitPrice: inv.unitPrice ?? inv.amount,
    totalAmount: inv.amount,
    status: inv.status,
    investmentDate: inv.startDate,
});

export const investmentService = {
    async list(filters: { investorId?: string; cageId?: string }) {
        const investments = await prisma.investment.findMany({
            where: {
                investorId: filters.investorId,
                cageId: filters.cageId,
            },
            orderBy: { createdAt: 'desc' },
            include: { cage: { select: { name: true } } },
        });
        return investments.map(mapInvestment);
    },

    async create(data: {
        investorId: string;
        cageId?: string;
        amount?: number;
        status: string;
        startDate?: Date;
        shareUnits?: number;
        unitPrice?: number;
    }) {
        // Validate investor
        const investor = await prisma.investor.findUnique({ where: { id: data.investorId } });
        if (!investor) throw new ApiError(404, 'Investor not found');

        // Validate cage if provided
        if (data.cageId) {
            const cage = await prisma.cage.findUnique({ where: { id: data.cageId } });
            if (!cage) throw new ApiError(404, 'Cage not found');
            // TODO: Check cage capacity logic here
        }

        const shareUnits = data.shareUnits ?? 1;
        const unitPrice = data.unitPrice ?? (data.amount ?? 0);
        const amount = data.amount ?? shareUnits * unitPrice;

        const created = await prisma.investment.create({
            data: {
                investorId: data.investorId,
                cageId: data.cageId,
                amount,
                shareUnits,
                unitPrice,
                status: data.status,
                roiPercent: 0, // Default
                startDate: data.startDate || new Date(),
            },
            include: { cage: { select: { name: true } } },
        });

        return mapInvestment(created);
    },

    async getById(id: string) {
        const inv = await prisma.investment.findUnique({
            where: { id },
            include: { cage: { select: { name: true } } },
        });
        if (!inv) throw new ApiError(404, 'Investment not found');
        return mapInvestment(inv);
    },

    async update(id: string, data: Partial<{ amount: number; status: string; startDate: Date; cageId: string; shareUnits: number; unitPrice: number }>) {
        const existing = await prisma.investment.findUnique({ where: { id } });
        if (!existing) throw new ApiError(404, 'Investment not found');

        const updated = await prisma.investment.update({
            where: { id },
            data: {
                ...data,
                amount: data.amount ?? ((data.shareUnits ?? existing.shareUnits) * (data.unitPrice ?? existing.unitPrice)),
            },
            include: { cage: { select: { name: true } } },
        });
        return mapInvestment(updated);
    },
};
