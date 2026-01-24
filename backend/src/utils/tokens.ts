import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type JwtPayload = {
  sub: string;
  role: 'admin' | 'manager' | 'viewer';
};

const accessSecret: jwt.Secret = env.JWT_ACCESS_SECRET;
const refreshSecret: jwt.Secret = env.JWT_REFRESH_SECRET;
const accessOptions: jwt.SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] };
const refreshOptions: jwt.SignOptions = { expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'] };

export const signAccessToken = (payload: JwtPayload) => jwt.sign(payload, accessSecret, accessOptions);

export const signRefreshToken = (payload: JwtPayload & { jti: string }) =>
  jwt.sign(payload, refreshSecret, refreshOptions);

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
export const verifyRefreshToken = (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & { jti: string };
