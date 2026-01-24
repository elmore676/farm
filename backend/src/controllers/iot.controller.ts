import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import iotService from '../services/iotService';
import { ApiError } from '../utils/apiError';

export const getDevices = asyncHandler(async (req: Request, res: Response) => {
  const filters = { cageId: req.query.cageId, status: req.query.status };
  const pagination = { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 10 };
  const result = await iotService.getDevices(filters, pagination);
  res.json(result);
});

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await iotService.registerDevice(req.body);
  res.status(201).json({ data: device });
});

export const updateDevice = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) throw new ApiError(400, 'deviceId is required');
  const device = await iotService.updateDevice(deviceId, req.body);
  res.json({ data: device });
});

export const recordReading = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) throw new ApiError(400, 'deviceId is required');
  const reading = await iotService.recordReading(deviceId, req.body);
  res.status(201).json({ data: reading });
});

export const getSensorReadings = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) throw new ApiError(400, 'deviceId is required');
  const sensorType = req.query.sensorType as string;
  const hours = parseInt(req.query.hours as string) || 24;
  const readings = await iotService.getSensorReadings(deviceId, sensorType, hours);
  res.json({ data: readings });
});

export const getAlerts = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  const status = (req.query.status as string) || undefined;
  const isActive = status === undefined ? undefined : status === 'active';
  const alerts = await iotService.getAlerts({ deviceId, isActive });
  res.json({ data: alerts });
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const cageId = req.params.cageId;
  if (!cageId) throw new ApiError(400, 'cageId is required');
  const summary = await iotService.getSummary(cageId);
  res.json({ data: summary });
});
