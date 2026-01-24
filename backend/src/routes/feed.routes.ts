import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listInventory, addStock, recordUsage, feedStats } from '../controllers/feed.controller';

const router = Router();
router.use(requireAuth);
router.get('/inventory', roleGuard(['admin', 'manager', 'viewer']), listInventory);
router.post('/inventory', roleGuard(['admin', 'manager']), addStock);
router.post('/usage', roleGuard(['admin', 'manager']), recordUsage);
router.get('/stats', roleGuard(['admin', 'manager', 'viewer']), feedStats);
export default router;
