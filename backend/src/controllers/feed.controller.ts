import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import feedService from '../services/feedService';

export const listInventory = asyncHandler(async (req: Request, res: Response) => {
	const filters = { status: req.query.status };
	const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
	const result = await feedService.getAll(filters, pagination);
	res.json(result);
});

export const addStock = asyncHandler(async (req: Request, res: Response) => {
	const stock = await feedService.create(req.body);
	res.status(201).json({ data: stock });
});

export const recordUsage = asyncHandler(async (req: Request, res: Response) => {
	const usage = await feedService.recordUsage(req.body);
	res.status(201).json({ data: usage });
});

export const feedStats = asyncHandler(async (_req: Request, res: Response) => {
	const inventory = await feedService.getInventory();
	res.json({ data: inventory });
});
