import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import financialService from '../services/financialService';
import { ApiError } from '../utils/apiError';

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const filters = { category: req.query.category, cycleId: req.query.cycleId };
  const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
  const result = await financialService.getExpenses(filters, pagination);
  res.json(result);
});

export const getRevenues = asyncHandler(async (req: Request, res: Response) => {
  const filters = { cycleId: req.query.cycleId };
  const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
  const result = await financialService.getRevenues(filters, pagination);
  res.json(result);
});

export const addExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await financialService.addExpense(req.body);
  res.status(201).json({ data: expense });
});

export const addRevenue = asyncHandler(async (req: Request, res: Response) => {
  const revenue = await financialService.addRevenue(req.body);
  res.status(201).json({ data: revenue });
});

export const getBudgetStatus = asyncHandler(async (req: Request, res: Response) => {
  const cycleId = req.params.cycleId;
  if (!cycleId) throw new ApiError(400, 'cycleId is required');
  const result = await financialService.getBudgetStatus(cycleId);
  res.json({ data: result });
});

export const getProfitability = asyncHandler(async (req: Request, res: Response) => {
  const cycleId = req.params.cycleId;
  if (!cycleId) throw new ApiError(400, 'cycleId is required');
  const result = await financialService.getProfitability(cycleId);
  res.json({ data: result });
});
