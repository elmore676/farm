import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listCages, createCage, getCage, updateCage, deleteCage, cageStats, getCageCycles, getCageInvestors } from '../controllers/cage.controller';

const router = Router();
router.use(requireAuth);
router.get('/', roleGuard(['admin', 'manager', 'viewer']), listCages);
router.get('/stats', roleGuard(['admin', 'manager', 'viewer']), cageStats);
router.post('/', roleGuard(['admin', 'manager']), createCage);
router.get('/:id', roleGuard(['admin', 'manager', 'viewer']), getCage);
router.get('/:id/cycles', roleGuard(['admin', 'manager', 'viewer']), getCageCycles);
router.get('/:id/investors', roleGuard(['admin', 'manager', 'viewer']), getCageInvestors);
router.put('/:id', roleGuard(['admin', 'manager']), updateCage);
router.delete('/:id', roleGuard(['admin']), deleteCage);
export default router;
