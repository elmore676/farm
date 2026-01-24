import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';
import { PrismaClient } from '@prisma/client';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '../utils/tokens';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'manager', 'viewer']).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.parse({ body: req.body });
  const user = await authService.register(parsed.body.name, parsed.body.email, parsed.body.password, parsed.body.role);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.parse({ body: req.body });
  const result = await authService.login(parsed.body.email, parsed.body.password);
  res.json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.refreshToken as string;
  if (!token) throw new ApiError(400, 'Missing refresh token');
  const payload = verifyRefreshToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.revokedAt) throw new ApiError(401, 'Invalid refresh token');
  const newJti = randomUUID();
  const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
  const refreshToken = signRefreshToken({ sub: payload.sub, role: payload.role, jti: newJti });
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: payload.jti }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        id: newJti,
        token: refreshToken,
        userId: payload.sub,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  res.json({ accessToken, refreshToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.refreshToken as string;
  if (token) {
    const payload = verifyRefreshToken(token);
    await prisma.refreshToken.updateMany({ where: { id: payload.jti }, data: { revokedAt: new Date() } });
  }
  res.json({ message: 'Logged out' });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) throw new ApiError(401, 'Unauthorized');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new ApiError(404, 'User not found');
  const permissions: Record<typeof user.role, string[]> = {
    admin: ['investors:read', 'investors:write', 'investments:read', 'investments:write', 'payouts:read', 'payouts:write', 'settings:write'],
    manager: ['investors:read', 'investors:write', 'investments:read', 'investments:write', 'payouts:read'],
    viewer: ['investors:read', 'investments:read', 'payouts:read'],
  };
  res.json({ user: { ...user, permissions: permissions[user.role] } });
});