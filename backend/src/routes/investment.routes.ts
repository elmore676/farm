import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listInvestments, createInvestment, getInvestment, updateInvestment } from '../controllers/investment.controller';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const createSchema = z.object({
	body: z.object({
		investorId: z.string().uuid(),
		cycleId: z.string().uuid().optional(),
		cageId: z.string().uuid().optional(),
		amount: z.number().positive().optional(),
		shareUnits: z.number().positive().optional(),
		unitPrice: z.number().positive().optional(),
		status: z.string().optional(),
		startDate: z.string().optional(),
		paymentMethod: z.string().optional(),
		transactionRef: z.string().optional(),
	}),
});

const updateSchema = z.object({
	body: z.object({
		cycleId: z.string().uuid().optional().nullable(),
		amount: z.number().positive().optional(),
		shareUnits: z.number().positive().optional(),
		unitPrice: z.number().positive().optional(),
		status: z.string().optional(),
		startDate: z.string().optional(),
		cageId: z.string().uuid().optional(),
		paymentMethod: z.string().optional(),
		transactionRef: z.string().optional(),
	}),
});

const router = Router();
router.use(requireAuth);
router.get('/', roleGuard(['admin', 'manager']), listInvestments);
router.post('/', roleGuard(['admin', 'manager']), validate(createSchema), createInvestment);
router.get('/:id', roleGuard(['admin', 'manager', 'viewer']), getInvestment);
router.put('/:id', roleGuard(['admin', 'manager']), validate(updateSchema), updateInvestment);
export default router;
