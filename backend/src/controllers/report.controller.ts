import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import reportService from '../services/reportService';

export const listReports = asyncHandler(async (req: Request, res: Response) => {
	const filters = { type: req.query.type };
	const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
	const result = await reportService.getReports(filters, pagination);
	res.json(result);
});

export const generateCycleReport = asyncHandler(async (req: Request, res: Response) => {
	const cycleId = req.params.cycleId;
	const report = await reportService.generateCycleReport(cycleId);
	res.status(201).json({ data: report });
});

export const generateFinancialReport = asyncHandler(async (req: Request, res: Response) => {
	const { startDate, endDate } = req.body;
	const report = await reportService.generateFinancialReport(new Date(startDate), new Date(endDate));
	res.status(201).json({ data: report });
});

export const generateInvestorReport = asyncHandler(async (req: Request, res: Response) => {
	const investorId = req.params.investorId;
	const report = await reportService.generateInvestorReport(investorId);
	res.status(201).json({ data: report });
});
