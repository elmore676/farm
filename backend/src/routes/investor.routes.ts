import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { 
  listInvestors, 
  createInvestor, 
  getInvestor, 
  updateInvestor, 
  deleteInvestor, 
  investorStats,
  recalculateInvestorMetrics,
  getInvestorPayoutSummary
} from '../controllers/investor.controller';

const router = Router();
router.use(requireAuth);
router.get('/', roleGuard(['admin', 'manager']), listInvestors);
router.get('/stats', roleGuard(['admin', 'manager', 'viewer']), investorStats);
router.post('/', roleGuard(['admin', 'manager']), createInvestor);
router.get('/:id', roleGuard(['admin', 'manager', 'viewer']), getInvestor);
router.get('/:id/payout-summary', roleGuard(['admin', 'manager', 'viewer']), getInvestorPayoutSummary);
router.get('/:id/recalculate-metrics', roleGuard(['admin', 'manager']), recalculateInvestorMetrics);
router.put('/:id', roleGuard(['admin', 'manager']), updateInvestor);
router.delete('/:id', roleGuard(['admin']), deleteInvestor);
export default router;
