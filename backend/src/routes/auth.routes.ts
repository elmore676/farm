import { Router } from 'express';
import { login, logout, refresh, register, me } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  body: z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) })
});

const loginSchema = z.object({
  body: z.object({ email: z.string().email(), password: z.string().min(8) })
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
