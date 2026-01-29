import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken } from '../utils/tokens';
import { ApiError } from '../utils/apiError';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export const authService = {
  async register(name: string, email: string, password: string, role: 'admin' | 'manager' | 'viewer' = 'viewer') {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'Email already registered');
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
    return user;
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid credentials');
    }
    const jti = randomUUID();
    const accessToken = signAccessToken({ sub: user.id, role: user.role as any });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role as any, jti });
    await prisma.refreshToken.create({
      data: { id: jti, token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL)) },
    });
    return { user, accessToken, refreshToken };
  },
};

// Simple ms parser for durations like "7d"
const ms = (val: string) => {
  const match = val.match(/^(\d+)([smhdw])$/);
  if (!match) return 0;
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 60 * 60 * 1000;
    case 'd':
      return n * 24 * 60 * 60 * 1000;
    case 'w':
      return n * 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
};
