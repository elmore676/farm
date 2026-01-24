import { PrismaClient, Investor, Investment, Payout } from '@prisma/client';
import { ApiError } from '../utils/apiError';

const prisma = new PrismaClient();

// Helper to map Prisma investor to frontend expected shape
const mapToFrontend = (investor: any) => {
    // Note: investor has real fields now.
    // Computed fields still needed.
    const totalInvestment = investor.investments?.reduce((sum: number, inv: Investment) => sum + inv.amount, 0) || 0;
    const totalReturns = investor.payouts?.reduce((sum: number, p: Payout) => p.status === 'paid' ? sum + p.amount : sum, 0) || 0;

    // activeCages count
    const activeCageIds = new Set(
        (investor.investments || [])
            .filter((inv: Investment) => inv.status === 'active' && inv.cageId)
            .map((inv: Investment) => inv.cageId)
    );

    return {
        id: investor.id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        address: investor.address,
        phoneNumber: investor.phone,

        // Real fields from DB
        idNumber: investor.idNumber || 'N/A',
        bankName: investor.bankName || 'N/A',
        accountNumber: investor.accountNumber || 'N/A',
        status: investor.status || 'active',
        kycStatus: investor.kycStatus || 'pending',

        // Computed
        totalInvestment,
        totalReturns,
        roi: totalInvestment > 0 ? ((totalReturns - totalInvestment) / totalInvestment) * 100 : 0,
        currentROI: 0,
        activeCages: activeCageIds.size,
        joinDate: investor.createdAt.toISOString(),
    };
};

export const investorService = {
    async create(data: any) {
        if (data.email) {
            const existing = await prisma.investor.findFirst({ where: { email: data.email } });
            if (existing) throw new ApiError(409, 'Investor with this email already exists');
        }

        // Extract real fields
        const { idNumber, bankName, accountNumber, status, kycStatus, ...rest } = data;

        const created = await prisma.investor.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone || data.phoneNumber,
                address: data.address,
                idNumber: data.idNumber,
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                status: data.status,
                kycStatus: data.kycStatus,
            },
            include: { investments: true, payouts: true }
        });
        return mapToFrontend(created);
    },

    async getAll() {
        const investors = await prisma.investor.findMany({
            orderBy: { createdAt: 'desc' },
            include: { investments: true, payouts: true }
        });
        return investors.map(mapToFrontend);
    },

    async getById(id: string) {
        const investor = await prisma.investor.findUnique({
            where: { id },
            include: { investments: true, payouts: true },
        });
        if (!investor) throw new ApiError(404, 'Investor not found');
        return mapToFrontend(investor);
    },

    async update(id: string, data: any) {
        if (data.email) {
            const existing = await prisma.investor.findFirst({ where: { email: data.email, NOT: { id } } });
            if (existing) throw new ApiError(409, 'Email already in use by another investor');
        }

        const updated = await prisma.investor.update({
            where: { id },
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone || data.phoneNumber,
                address: data.address,
                idNumber: data.idNumber,
                bankName: data.bankName,
                accountNumber: data.accountNumber,
                status: data.status,
                kycStatus: data.kycStatus,
            },
            include: { investments: true, payouts: true }
        });
        return mapToFrontend(updated);
    },

    async delete(id: string) {
        const existing = await prisma.investor.findUnique({ where: { id } });
        if (!existing) throw new ApiError(404, 'Investor not found');
        return prisma.investor.delete({ where: { id } });
    },
};
