import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import cycleService from '../services/cycleService';
import investmentService from '../services/investmentService';

export const listCycles = asyncHandler(async (req: Request, res: Response) => {
	const filters = { status: req.query.status, cageId: req.query.cageId };
	const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
	const result = await cycleService.getAll(filters, pagination);
	res.json({ data: result.data, meta: result.pagination });
});

export const createCycle = asyncHandler(async (req: Request, res: Response) => {
	const cycle = await cycleService.create(req.body);
	res.status(201).json({ data: cycle });
});

export const getCycle = asyncHandler(async (req: Request, res: Response) => {
	const cycle = await cycleService.getById(req.params.id);
	res.json({ data: cycle });
});

export const getCycleInvestments = asyncHandler(async (req: Request, res: Response) => {
	const investments = await investmentService.getByCycle(req.params.id);
	res.json({ data: investments });
});

export const updateCycle = asyncHandler(async (req: Request, res: Response) => {
	const cycle = await cycleService.update(req.params.id, req.body);
	res.json({ data: cycle });
});

export const addDailyLog = asyncHandler(async (req: Request, res: Response) => {
	const log = await cycleService.addDailyLog(req.params.id, req.body);
	res.status(201).json({ data: log });
});

export const getCycleDailyLogs = asyncHandler(async (req: Request, res: Response) => {
	const logs = await cycleService.getDailyLogs(req.params.id);
	res.json({ data: logs });
});

export const addHarvest = asyncHandler(async (req: Request, res: Response) => {
	const harvest = await cycleService.update(req.params.id, { status: 'completed', ...req.body });
	res.status(201).json({ data: harvest });
});

export const cycleStats = asyncHandler(async (_req: Request, res: Response) => {
	const stats = await cycleService.getStats(_req.params.id);
	res.json({ data: stats });
});

export const getCycleWeightSamples = asyncHandler(async (req: Request, res: Response) => {
	const samples = await cycleService.getWeightSamples(req.params.id);
	res.json({ data: samples });
});

export const addWeightSample = asyncHandler(async (req: Request, res: Response) => {
	const sample = await cycleService.addWeightSample(req.params.id, req.body);
	res.status(201).json({ data: sample });
});
