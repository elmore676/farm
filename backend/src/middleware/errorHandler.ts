import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof ApiError ? err.message : 'Internal Server Error';

  if (!(err instanceof ApiError)) {
    logger.error({ err, path: req.path, method: req.method });
  }

  res.status(status).json({
    message,
    ...(isProd ? {} : { stack: (err as Error)?.stack, details: (err as ApiError)?.details }),
  });
};
