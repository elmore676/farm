import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import investorService from '../services/investorService';
import { ApiError } from '../utils/apiError';

export const listInvestors = asyncHandler(async (req: Request, res: Response) => {
  const filters = { status: req.query.status, search: req.query.search };
  const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
  const result = await investorService.getAll(filters, pagination);
  res.json(result);
});

export const createInvestor = asyncHandler(async (req: Request, res: Response) => {
  const investor = await investorService.create(req.body);
  res.status(201).json({ data: investor });
});

export const getInvestor = asyncHandler(async (req: Request, res: Response) => {
  const investor = await investorService.getById(req.params.id);
  res.json({ data: investor });
});

export const updateInvestor = asyncHandler(async (req: Request, res: Response) => {
  const investor = await investorService.update(req.params.id, req.body);
  res.json({ data: investor });
});

export const deleteInvestor = asyncHandler(async (req: Request, res: Response) => {
  await investorService.delete(req.params.id);
  res.status(204).send();
});

export const investorStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await investorService.getStats();
  res.json({ data: stats });
});

/**
 * Recalculate investor metrics (totalInvestment, totalReturns, ROI)
 * GET /api/investors/:id/recalculate-metrics
 */
export const recalculateInvestorMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, 'Investor ID is required');

  const investor = await investorService.recalculateInvestorMetrics(id);
  res.json({
    message: 'Investor metrics recalculated',
    data: investor,
  });
});

/**
 * Get investor's payout summary
 * GET /api/investors/:id/payout-summary
 */
export const getInvestorPayoutSummary = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, 'Investor ID is required');

  const summary = await investorService.getPayoutSummary(id);
  res.json({ data: summary });
});
