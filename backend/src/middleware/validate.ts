import { AnyZodObject } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';

export const validate = (schema: AnyZodObject) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error: any) {
    next(new ApiError(400, 'Validation failed', error.flatten?.()));
  }
};
