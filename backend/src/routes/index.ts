import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import investorRoutes from './investor.routes';
import investmentRoutes from './investment.routes';
import cageRoutes from './cage.routes';
import cycleRoutes from './cycle.routes';
import feedRoutes from './feed.routes';
import waterQualityRoutes from './waterQuality.routes';
import payoutRoutes from './payout.routes';
import reportRoutes from './report.routes';
import investmentReportRoutes from './investmentReport.routes';
import financialRoutes from './financial.routes';
import notificationRoutes from './notification.routes';
import iotRoutes from './iot.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/investors', investorRoutes);
router.use('/investments', investmentRoutes);
router.use('/cages', cageRoutes);
router.use('/cycles', cycleRoutes);
router.use('/feed', feedRoutes);
router.use('/water-quality', waterQualityRoutes);
router.use('/payouts', payoutRoutes);
router.use('/reports', reportRoutes);
router.use('/reports/investment', investmentReportRoutes);
router.use('/finance', financialRoutes);
router.use('/notifications', notificationRoutes);
router.use('/iot', iotRoutes);

export default router;
