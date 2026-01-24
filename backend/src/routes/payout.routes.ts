import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import {
	initiatePayouts,
	getPayouts,
	getPayoutById,
	approvePayout,
	processPayout,
	rejectPayout,
	getPayoutSummary,
	getPayoutsByCycle,
	estimatePayouts,
	calculatePayout,
	recordPayout,
	getPayoutHistory,
} from '../controllers/payout.controller';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * New payout endpoints - comprehensive system
 */

// POST /api/payouts/initiate - Initiate payouts for harvested cycle
router.post('/initiate', roleGuard(['admin', 'manager']), initiatePayouts);

// POST /api/payouts/estimate - Estimate payouts for active cycle
router.post('/estimate', roleGuard(['admin', 'manager', 'viewer']), estimatePayouts);

// GET /api/payouts/summary - Get payout statistics
router.get('/summary', roleGuard(['admin', 'manager', 'viewer']), getPayoutSummary);

// GET /api/payouts - Get all payouts with optional filters
router.get('/', roleGuard(['admin', 'manager', 'viewer']), getPayouts);

// GET /api/payouts/:id - Get payout by ID
router.get('/:id', roleGuard(['admin', 'manager', 'viewer']), getPayoutById);

// PATCH /api/payouts/:id/approve - Approve payout
router.patch('/:id/approve', roleGuard(['admin', 'manager']), approvePayout);

// PATCH /api/payouts/:id/process - Process/Complete payout
router.patch('/:id/process', roleGuard(['admin']), processPayout);

// PATCH /api/payouts/:id/reject - Reject payout
router.patch('/:id/reject', roleGuard(['admin', 'manager']), rejectPayout);

// GET /api/payouts/cycle/:cycleId - Get payouts by cycle
router.get('/cycle/:cycleId', roleGuard(['admin', 'manager', 'viewer']), getPayoutsByCycle);

/**
 * Legacy endpoints - kept for backwards compatibility
 */
router.post('/calculate', roleGuard(['admin', 'manager']), calculatePayout);
router.post('/record', roleGuard(['admin']), recordPayout);
router.get('/investor/:investorId/history', roleGuard(['admin', 'manager', 'viewer']), getPayoutHistory);

export default router;
