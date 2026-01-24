import { Request, Response } from 'express';
import investmentReportService from '../services/investmentReportService';

export class InvestmentReportController {
  /**
   * Get investor's returns by cycle
   * GET /api/reports/investment/:investorId/returns-by-cycle
   */
  static async getReturnsByCycle(req: Request, res: Response) {
    try {
      const { investorId } = req.params;
      const returns = await investmentReportService.getInvestorReturnsByCycle(investorId);
      
      res.json({
        success: true,
        data: returns,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Calculate ROI for an investor
   * GET /api/reports/investment/:investorId/roi
   */
  static async calculateROI(req: Request, res: Response) {
    try {
      const { investorId } = req.params;
      const roiData = await investmentReportService.calculateROI(investorId);
      
      res.json({
        success: true,
        data: roiData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get investment breakdown for an investor
   * GET /api/reports/investment/:investorId/breakdown
   */
  static async getBreakdown(req: Request, res: Response) {
    try {
      const { investorId } = req.params;
      const breakdown = await investmentReportService.getInvestmentBreakdown(investorId);
      
      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get comparative analysis across investors
   * GET /api/reports/investment/comparative/analysis
   */
  static async getComparativeAnalysis(req: Request, res: Response) {
    try {
      const analysis = await investmentReportService.getComparativeAnalysis();
      
      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get portfolio performance summary
   * GET /api/reports/investment/portfolio/performance
   */
  static async getPortfolioPerformance(req: Request, res: Response) {
    try {
      const performance = await investmentReportService.getPortfolioPerformance();
      
      res.json({
        success: true,
        data: performance,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get financial report for a cycle
   * GET /api/reports/investment/cycle/:cycleId
   */
  static async getCycleFinancialReport(req: Request, res: Response) {
    try {
      const { cycleId } = req.params;
      const report = await investmentReportService.getCycleFinancialReport(cycleId);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Get summary report (all metrics)
   * GET /api/reports/investment/:investorId/summary
   */
  static async getSummary(req: Request, res: Response) {
    try {
      const { investorId } = req.params;
      
      const [breakdown, portfolio] = await Promise.all([
        investmentReportService.getInvestmentBreakdown(investorId),
        investmentReportService.getPortfolioPerformance(),
      ]);
      
      res.json({
        success: true,
        data: {
          investmentBreakdown: breakdown,
          portfolioContext: portfolio,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default InvestmentReportController;
