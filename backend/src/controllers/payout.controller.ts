import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import payoutService from '../services/payoutService';
import { ApiError } from '../utils/apiError';

/**
 * Initiate payouts for a harvested cycle
 * Calculates payout allocations based on revenue, expenses, and investor shares
 * POST /api/payouts/initiate
 */
export const initiatePayouts = asyncHandler(async (req: Request, res: Response) => {
	const { cycleId, harvestedStock, harvestWeight, revenue, farmExpenses, harvestDate } = req.body;

	// Validate required fields
	if (!cycleId || revenue === undefined || farmExpenses === undefined) {
		throw new ApiError(400, 'cycleId, revenue, and farmExpenses are required');
	}

	const input = {
		cycleId,
		harvestedStock: harvestedStock || 0,
		harvestWeight: harvestWeight || 0,
		revenue: parseFloat(revenue),
		farmExpenses: parseFloat(farmExpenses),
		harvestDate: harvestDate || new Date().toISOString(),
	};

	const result = await payoutService.initiatePayoutsForHarvestedCycle(input);
	res.status(201).json({
		message: 'Payouts initiated successfully',
		data: result,
	});
});

/**
 * Get all payouts with optional filtering
 * GET /api/payouts?status=pending&investorId=xxx
 */
export const getPayouts = asyncHandler(async (req: Request, res: Response) => {
	const { status, investorId } = req.query;

	let payouts;
	if (investorId) {
		payouts = await payoutService.getInvestorPayouts(investorId as string, status as string | undefined);
	} else if (status) {
		payouts = await payoutService.getPendingPayouts(); // Can be enhanced to filter by status
	} else {
		payouts = await payoutService.getPendingPayouts();
	}

	res.json({
		data: payouts,
		count: payouts.length,
	});
});

/**
 * Get payout by ID
 * GET /api/payouts/:id
 */
export const getPayoutById = asyncHandler(async (req: Request, res: Response) => {
	const { id } = req.params;
	if (!id) throw new ApiError(400, 'Payout ID is required');

	const payout = await payoutService.getPayoutById(id);
	if (!payout) {
		throw new ApiError(404, 'Payout not found');
	}

	res.json({ data: payout });
});

/**
 * Approve a payout (mark as ready for payment)
 * PATCH /api/payouts/:id/approve
 */
export const approvePayout = asyncHandler(async (req: Request, res: Response) => {
	const { id } = req.params;
	if (!id) throw new ApiError(400, 'Payout ID is required');

	const payout = await payoutService.approvePayout(id);
	res.json({
		message: 'Payout approved successfully',
		data: payout,
	});
});

/**
 * Process/Complete a payout (mark as paid)
 * PATCH /api/payouts/:id/process
 */
export const processPayout = asyncHandler(async (req: Request, res: Response) => {
	const { id } = req.params;
	const { paymentRef } = req.body;

	if (!id) throw new ApiError(400, 'Payout ID is required');

	const payout = await payoutService.processPayout(id, paymentRef);
	res.json({
		message: 'Payout processed successfully',
		data: payout,
	});
});

/**
 * Reject a payout
 * PATCH /api/payouts/:id/reject
 */
export const rejectPayout = asyncHandler(async (req: Request, res: Response) => {
	const { id } = req.params;
	if (!id) throw new ApiError(400, 'Payout ID is required');

	const payout = await payoutService.rejectPayout(id);
	res.json({
		message: 'Payout rejected',
		data: payout,
	});
});

/**
 * Get payout summary statistics
 * GET /api/payouts/summary
 */
export const getPayoutSummary = asyncHandler(async (req: Request, res: Response) => {
	const summary = await payoutService.getPayoutSummary();
	res.json({ data: summary });
});

/**
 * Get payouts for a specific cycle
 * GET /api/payouts/cycle/:cycleId
 */
export const getPayoutsByCycle = asyncHandler(async (req: Request, res: Response) => {
	const cycleId = req.params.cycleId;
	if (!cycleId) throw new ApiError(400, 'cycleId is required');
	const result = await payoutService.getPayoutsByCycle(cycleId);
	res.json({ data: result });
});

/**
 * Calculate estimated payouts for an active cycle
 * POST /api/payouts/estimate
 */
export const estimatePayouts = asyncHandler(async (req: Request, res: Response) => {
	const { cycleId, projectedRevenue, projectedExpenses } = req.body;

	if (!cycleId || projectedRevenue === undefined || projectedExpenses === undefined) {
		throw new ApiError(400, 'cycleId, projectedRevenue, and projectedExpenses are required');
	}

	const estimates = await payoutService.estimatePayoutsForActiveCycle(
		cycleId,
		parseFloat(projectedRevenue),
		parseFloat(projectedExpenses)
	);

	res.json({
		message: 'Payout estimates calculated',
		data: estimates,
	});
});

// Legacy endpoints kept for backwards compatibility
export const calculatePayout = asyncHandler(async (req: Request, res: Response) => {
	const { investorId, cycleId } = req.body;
	if (!investorId || !cycleId) throw new ApiError(400, 'investorId and cycleId are required');
	const result = await payoutService.calculatePayout(investorId, cycleId);
	res.json({ data: result });
});

export const recordPayout = asyncHandler(async (req: Request, res: Response) => {
	const payout = await payoutService.recordPayout(req.body);
	res.status(201).json({ data: payout });
});

export const getPayoutHistory = asyncHandler(async (req: Request, res: Response) => {
	const investorId = req.params.investorId;
	if (!investorId) throw new ApiError(400, 'investorId is required');
	const result = await payoutService.getPayoutHistory(investorId);
	res.json({ data: result });
});
