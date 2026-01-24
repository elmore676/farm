import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: [] });
});

export const getUser = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: null });
});

export const createUser = asyncHandler(async (_req: Request, res: Response) => {
  res.status(201).json({ data: null });
});

export const updateUser = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: null });
});

export const deleteUser = asyncHandler(async (_req: Request, res: Response) => {
  res.status(204).send();
});
