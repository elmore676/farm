import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listLogs, createLog, listAlerts } from '../controllers/waterQuality.controller';

const router = Router();
router.use(requireAuth);
router.get('/logs', roleGuard(['admin', 'manager', 'viewer']), listLogs);
router.post('/logs', roleGuard(['admin', 'manager']), createLog);
router.get('/alerts', roleGuard(['admin', 'manager', 'viewer']), listAlerts);
export default router;
