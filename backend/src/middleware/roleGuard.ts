import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

export const roleGuard = (requiredRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req.user?.role as string) || 'investor';

    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};

export default roleGuard;
