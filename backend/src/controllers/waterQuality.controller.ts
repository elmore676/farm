import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import waterQualityService from '../services/waterQualityService';

export const listLogs = asyncHandler(async (req: Request, res: Response) => {
	const filters = { cageId: req.query.cageId };
	const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
	const result = await waterQualityService.getAll(filters, pagination);
	res.json(result);
});

export const createLog = asyncHandler(async (req: Request, res: Response) => {
	const log = await waterQualityService.create(req.body);
	res.status(201).json({ data: log });
});

export const listAlerts = asyncHandler(async (req: Request, res: Response) => {
	const cageId = req.query.cageId as string;
	const alerts = await waterQualityService.checkAlerts(cageId);
	res.json({ data: alerts });
});
