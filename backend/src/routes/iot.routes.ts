import { Router } from 'express';
import { getDevices, registerDevice, updateDevice, recordReading, getSensorReadings, getAlerts, getSummary } from '../controllers/iot.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/devices', getDevices);
router.post('/devices', registerDevice);
router.put('/devices/:deviceId', updateDevice);
router.post('/devices/:deviceId/readings', recordReading);
router.get('/devices/:deviceId/readings', getSensorReadings);
router.get('/devices/:deviceId/alerts', getAlerts);
router.get('/cage/:cageId/summary', getSummary);

export default router;
