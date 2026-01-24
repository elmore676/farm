import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listReports, generateCycleReport, generateFinancialReport, generateInvestorReport } from '../controllers/report.controller';

const router = Router();
router.use(requireAuth);

router.get('/', roleGuard(['admin', 'manager', 'viewer']), listReports);
router.post('/cycle/:cycleId', roleGuard(['admin', 'manager']), generateCycleReport);
router.post('/financial', roleGuard(['admin', 'manager']), generateFinancialReport);
router.post('/investor/:investorId', roleGuard(['admin', 'manager']), generateInvestorReport);

export default router;
