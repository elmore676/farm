import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import cageService from '../services/cageService';
import cycleService from '../services/cycleService';
import investmentService from '../services/investmentService';

export const listCages = asyncHandler(async (req: Request, res: Response) => {
  const filters = { status: req.query.status, location: req.query.location };
  const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
  const result = await cageService.getAll(filters, pagination);
  res.json(result);
});

export const createCage = asyncHandler(async (req: Request, res: Response) => {
  const cage = await cageService.create(req.body);
  res.status(201).json({ data: cage });
});

export const getCage = asyncHandler(async (req: Request, res: Response) => {
  const cage = await cageService.getById(req.params.id);
  res.json({ data: cage });
});

export const getCageCycles = asyncHandler(async (req: Request, res: Response) => {
  const result = await cycleService.getAll({ cageId: req.params.id }, { page: 1, limit: 100 });
  res.json({ data: result.data });
});

export const getCageInvestors = asyncHandler(async (req: Request, res: Response) => {
  const investments = await investmentService.getByCage(req.params.id);
  // Return investments with nested investor and cycle info; UI can compute share percentages
  res.json({ data: investments });
});

export const updateCage = asyncHandler(async (req: Request, res: Response) => {
  const cage = await cageService.update(req.params.id, req.body);
  res.json({ data: cage });
});

export const deleteCage = asyncHandler(async (req: Request, res: Response) => {
  await cageService.delete(req.params.id);
  res.status(204).send();
});

export const cageStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await cageService.getStats();
  res.json({ data: stats });
});
