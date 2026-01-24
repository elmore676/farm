import bcrypt from 'bcrypt';
import { env } from '../config/env';

export const hashPassword = async (plain: string) => bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
export const comparePassword = async (plain: string, hash: string) => bcrypt.compare(plain, hash);
