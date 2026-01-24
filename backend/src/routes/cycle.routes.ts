import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listCycles, createCycle, getCycle, updateCycle, addDailyLog, addHarvest, cycleStats, getCycleInvestments, getCycleDailyLogs, getCycleWeightSamples, addWeightSample } from '../controllers/cycle.controller';

const router = Router();
router.use(requireAuth);
router.get('/', roleGuard(['admin', 'manager', 'viewer']), listCycles);
router.get('/stats', roleGuard(['admin', 'manager', 'viewer']), cycleStats);
 router.post('/', roleGuard(['admin', 'manager']), createCycle);
 router.post('/:id/daily-logs', roleGuard(['admin', 'manager']), addDailyLog);
 router.get('/:id/daily-logs', roleGuard(['admin', 'manager', 'viewer']), getCycleDailyLogs);
 router.post('/:id/weight-samples', roleGuard(['admin', 'manager']), addWeightSample);
 router.get('/:id/weight-samples', roleGuard(['admin', 'manager', 'viewer']), getCycleWeightSamples);
 router.post('/:id/harvest', roleGuard(['admin', 'manager']), addHarvest);
 router.get('/:id', roleGuard(['admin', 'manager', 'viewer']), getCycle);
 router.get('/:id/investments', roleGuard(['admin', 'manager', 'viewer']), getCycleInvestments);
 router.put('/:id', roleGuard(['admin', 'manager']), updateCycle);
export default router;
