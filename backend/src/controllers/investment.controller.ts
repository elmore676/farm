import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import investmentService from '../services/investmentService';
import { ApiError } from '../utils/apiError';

export const listInvestments = asyncHandler(async (req: Request, res: Response) => {
	const filters = { 
		investorId: req.query.investorId, 
		cageId: req.query.cageId, 
		cycleId: req.query.cycleId,
		status: req.query.status 
	};
	const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
	const result = await investmentService.getAll(filters, pagination);
	res.json(result);
});

export const createInvestment = asyncHandler(async (req: Request, res: Response) => {
	const investment = await investmentService.create(req.body);
	res.status(201).json({ data: investment });
});

export const getInvestment = asyncHandler(async (req: Request, res: Response) => {
	const investment = await investmentService.getById(req.params.id);
	res.json({ data: investment });
});

export const updateInvestment = asyncHandler(async (req: Request, res: Response) => {
	const investment = await investmentService.update(req.params.id, req.body);
	res.json({ data: investment });
});

export const deleteInvestment = asyncHandler(async (req: Request, res: Response) => {
	await investmentService.delete(req.params.id);
	res.status(204).send();
});
