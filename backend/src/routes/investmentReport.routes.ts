import express, { Router } from 'express';
import InvestmentReportController from '../controllers/investmentReport.controller';
import { requireAuth } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router: Router = express.Router();

/**
 * Investment Report Routes
 * All routes require authentication
 */

// Get investor's returns by cycle
router.get(
  '/:investorId/returns-by-cycle',
  requireAuth,
  InvestmentReportController.getReturnsByCycle
);

// Calculate ROI for an investor
router.get(
  '/:investorId/roi',
  requireAuth,
  InvestmentReportController.calculateROI
);

// Get investment breakdown for an investor
router.get(
  '/:investorId/breakdown',
  requireAuth,
  InvestmentReportController.getBreakdown
);

// Get investment summary (breakdown + portfolio context)
router.get(
  '/:investorId/summary',
  requireAuth,
  InvestmentReportController.getSummary
);

// Get comparative analysis across investors (admin/manager only)
router.get(
  '/comparative/analysis',
  requireAuth,
  roleGuard(['admin', 'manager']),
  InvestmentReportController.getComparativeAnalysis
);

// Get portfolio performance summary (admin/manager only)
router.get(
  '/portfolio/performance',
  requireAuth,
  roleGuard(['admin', 'manager']),
  InvestmentReportController.getPortfolioPerformance
);

// Get financial report for a cycle
router.get(
  '/cycle/:cycleId',
  requireAuth,
  InvestmentReportController.getCycleFinancialReport
);

export default router;
