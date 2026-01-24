import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { ApiError } from '../utils/apiError';

export interface AuthRequest extends Request {
  user?: { id: string; role: 'admin' | 'manager' | 'viewer' };
}

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized'));
  }
  const token = header.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid token'));
  }
};

export const roleGuard = (roles: Array<'admin' | 'manager' | 'viewer'>) => (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) return next(new ApiError(401, 'Unauthorized'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'Forbidden'));
  return next();
};
