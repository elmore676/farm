import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { getExpenses, getRevenues, addExpense, addRevenue, getBudgetStatus, getProfitability } from '../controllers/financial.controller';

const router = Router();
router.use(requireAuth);

router.get('/expenses', roleGuard(['admin', 'manager', 'viewer']), getExpenses);
router.get('/revenues', roleGuard(['admin', 'manager', 'viewer']), getRevenues);
router.post('/expenses', roleGuard(['admin', 'manager']), addExpense);
router.post('/revenues', roleGuard(['admin', 'manager']), addRevenue);
router.get('/cycles/:cycleId/budget', roleGuard(['admin', 'manager', 'viewer']), getBudgetStatus);
router.get('/cycles/:cycleId/profitability', roleGuard(['admin', 'manager', 'viewer']), getProfitability);

export default router;
