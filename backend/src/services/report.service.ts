import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { templateRenderer } from './templateRenderer';
import { pdfGenerator } from './pdfGenerator';
import { excelGenerator } from './excelGenerator';
import { aggregationService } from './aggregation.service';

// Simple in-memory stores; replace with Prisma-backed persistence when schema is ready.
const reportStore: Record<string, any> = {};
const scheduleStore: Record<string, any> = {};

export type ReportType =
  | 'cycle-performance'
  | 'investor-roi'
  | 'financial-summary'
  | 'feed-usage'
  | 'water-quality'
  | 'operations-dashboard'
  | 'custom';

export type ReportFormat = 'pdf' | 'excel' | 'csv';

export class ReportService {
  private db = prisma as any;
  private outDir = path.join(process.cwd(), 'logs', 'reports');

  constructor() {
    if (!fs.existsSync(this.outDir)) fs.mkdirSync(this.outDir, { recursive: true });
  }

  async generateOnDemand(opts: { type: ReportType; params: any; format: ReportFormat; requestedBy: string }) {
    const id = uuidv4();
    const generatedAt = new Date();

    const data = await this.buildData(opts.type, opts.params);
    const html = templateRenderer.render(opts.type, data);

    const file = await this.writeFile(id, opts.type, opts.format, html, data);

    const meta = { id, type: opts.type, format: opts.format, generatedAt, requestedBy: opts.requestedBy, params: opts.params, file };
    reportStore[id] = meta;
    return meta;
  }

  async buildData(type: ReportType, params: any) {
    // NOTE: Replace with real aggregations/SQL. For now, stub data with minimal fields.
    switch (type) {
      case 'cycle-performance':
        return this.buildCyclePerformance(params);
      case 'investor-roi':
        return this.buildInvestorRoi(params);
      case 'financial-summary':
        return this.buildFinancialSummary(params);
      case 'feed-usage':
        return this.buildFeedUsage(params);
      case 'water-quality':
        return this.buildWaterQuality(params);
      case 'operations-dashboard':
        return this.buildOperationsDashboard(params);
      case 'custom':
      default:
        return { title: 'Custom Report', params, rows: [] };
    }
  }

  private async buildCyclePerformance(params: any) {
    // Example metrics; real implementation should query prisma.cycle, expenses, revenues, feedUsage, waterQuality, etc.
    const { cycleId, cageId, from, to } = params;
    const dateRange = this.normalizeRange(from, to);

    const cycle = cycleId
      ? await this.db.cycle.findUnique({ where: { id: cycleId } })
      : await this.db.cycle.findFirst({
          where: {
            cageId: cageId ?? undefined,
            startDate: dateRange ? { lte: dateRange.to } : undefined,
            endDate: dateRange ? { gte: dateRange.from } : undefined,
          },
          orderBy: { startDate: 'desc' },
        });

    const feedUsage = await this.db.feedUsage.aggregate({
      where: {
        cageId: cageId ?? cycle?.cageId ?? undefined,
        cycleId: cycle?.id ?? undefined,
        date: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
      _sum: { quantityKg: true },
    });

    const expenses = await this.db.expense.aggregate({
      where: {
        cageId: cageId ?? cycle?.cageId ?? undefined,
        cycleId: cycle?.id ?? undefined,
        incurredAt: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
      _sum: { amount: true },
    });

    const revenues = await this.db.revenue.aggregate({
      where: {
        cageId: cageId ?? cycle?.cageId ?? undefined,
        cycleId: cycle?.id ?? undefined,
        occurredAt: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
      _sum: { amount: true, quantityKg: true },
    });

    const harvestYield = revenues._sum.quantityKg ?? 0;
    const feedKg = feedUsage._sum.quantityKg ?? 0;
    const fcr = feedKg && harvestYield ? feedKg / harvestYield : null;

    return {
      title: 'Cycle Performance',
      params,
      cycle,
      metrics: {
        fcr,
        survivalRate: cycle?.mortality != null && cycle?.initialStock
          ? (cycle.initialStock - (cycle.mortality ?? 0)) / cycle.initialStock
          : null,
        growthRate: cycle?.biomassStart && cycle?.biomassEnd && cycle?.biomassStart > 0
          ? cycle.biomassEnd / cycle.biomassStart
          : null,
        harvestYield,
      },
      costBreakdown: [{ category: 'total', amount: expenses._sum.amount ?? 0 }],
      profitability: {
        revenue: revenues._sum.amount ?? 0,
        expense: expenses._sum.amount ?? 0,
        profit: (revenues._sum.amount ?? 0) - (expenses._sum.amount ?? 0),
      },
      recommendations: ['Tighten feed schedule during week 6-8', 'Monitor DO during hot days'],
    };
  }

  private async buildInvestorRoi(params: any) {
    const { investorId, from, to } = params;
    const dateRange = this.normalizeRange(from, to);

    const investments = await this.db.investment.findMany({
      where: {
        investorId,
        startDate: dateRange ? { lte: dateRange.to } : undefined,
      },
      include: { cage: true },
    });

    const payouts = await this.db.payout.findMany({
      where: {
        investorId,
        createdAt: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
    });

    const invested = investments.reduce((sum: number, inv: any) => sum + (inv.amount ?? 0), 0);
    const returned = payouts.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
    const roiPercent = invested ? (returned / invested) * 100 : null;

    return {
      title: 'Investor ROI',
      params,
      investments,
      returnsByCage: [],
      roiPercent,
      payouts,
      ytd: { invested, returned },
    };
  }

  private async buildFinancialSummary(params: any) {
    const { cageId, from, to } = params;
    const dateRange = this.normalizeRange(from, to);

    const revenues = await this.db.revenue.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: {
        cageId: cageId ?? undefined,
        occurredAt: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
    });

    const expenses = await this.db.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: {
        cageId: cageId ?? undefined,
        incurredAt: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
    });

    const revenueTotal = revenues.reduce((sum: number, r: any) => sum + (r._sum.amount ?? 0), 0);
    const expenseTotal = expenses.reduce((sum: number, r: any) => sum + (r._sum.amount ?? 0), 0);

    return {
      title: 'Financial Summary',
      params,
      revenueBySource: revenues,
      expensesByCategory: expenses,
      pnl: { revenue: revenueTotal, expense: expenseTotal, profit: revenueTotal - expenseTotal },
      cashflow: [],
      budgetVariance: [],
      ratios: [{ name: 'Gross Margin', value: revenueTotal ? (revenueTotal - expenseTotal) / revenueTotal : null }],
    };
  }

  private async buildFeedUsage(params: any) {
    const { cageId, from, to } = params;
    const dateRange = this.normalizeRange(from, to);

    const usage = await this.db.feedUsage.groupBy({
      by: ['feedType'],
      _sum: { quantityKg: true },
      where: {
        cageId: cageId ?? undefined,
        date: dateRange ? { gte: dateRange.from, lte: dateRange.to } : undefined,
      },
    });

    const totalFeed = usage.reduce((sum: number, u: any) => sum + (u._sum.quantityKg ?? 0), 0);

    return {
      title: 'Feed Usage',
      params,
      totalFeed,
      byType: usage,
      fcr: null,
      costPerKg: null,
      wastage: null,
      suppliers: [],
      recommendations: ['Review feeding frequency based on biomass growth curve'],
    };
  }

  private async buildWaterQuality(params: any) {
    const { cageId, from, to } = params;
    const range = this.normalizeRange(from, to) ?? { from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: new Date() };
    const agg = await aggregationService.aggregatePeriod(cageId, 'temperature', 'hour', range.from, range.to);
    return {
      title: 'Water Quality',
      params,
      trends: [],
      averages: { temperature: agg?.value_avg ?? 0 },
      thresholdViolations: [],
      correlations: [],
      seasonal: [],
      compliance: [],
    };
  }

  private async buildOperationsDashboard(params: any) {
    const cages = await this.db.cage.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const biomass = await this.db.cycle.aggregate({ _sum: { biomassEnd: true } });

    return {
      title: 'Operations Dashboard',
      params,
      cages,
      biomass: biomass._sum.biomassEnd ?? 0,
      dailyOps: [],
      productivity: [],
      tasks: [],
      alerts: [],
    };
  }

  private normalizeRange(from?: any, to?: any): { from: Date; to: Date } | null {
    if (!from && !to) return null;
    const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : new Date();
    return { from: start, to: end };
  }

  private async writeFile(id: string, type: string, format: ReportFormat, html: string, data: any) {
    switch (format) {
      case 'excel':
        return excelGenerator.generate(id, type, data, this.outDir);
      case 'csv':
        return excelGenerator.generateCsv(id, type, data, this.outDir);
      case 'pdf':
      default:
        return pdfGenerator.generate(id, type, html, this.outDir);
    }
  }

  async listReports() {
    return Object.values(reportStore).sort((a, b) => b.generatedAt - a.generatedAt);
  }

  async getReport(id: string) {
    return reportStore[id];
  }

  async getReportFile(id: string) {
    return reportStore[id]?.file;
  }

  async createSchedule(input: any) {
    const id = uuidv4();
    const schedule = { id, ...input, createdAt: new Date() };
    scheduleStore[id] = schedule;
    // Hook into cron scheduler when ready
    return schedule;
  }

  async listSchedules() {
    return Object.values(scheduleStore);
  }

  async updateSchedule(id: string, input: any) {
    if (!scheduleStore[id]) return null;
    scheduleStore[id] = { ...scheduleStore[id], ...input, updatedAt: new Date() };
    return scheduleStore[id];
  }

  async deleteSchedule(id: string) {
    if (!scheduleStore[id]) return false;
    delete scheduleStore[id];
    return true;
  }

  async generateCustom(input: any, requestedBy: string) {
    const id = uuidv4();
    const generatedAt = new Date();
    const data = { title: 'Custom Report', input };
    const html = templateRenderer.render('custom', data);
    const file = await this.writeFile(id, 'custom', input.format ?? 'pdf', html, data);
    const meta = { id, type: 'custom', format: input.format ?? 'pdf', generatedAt, requestedBy, params: input, file };
    reportStore[id] = meta;
    return meta;
  }
}

export const reportService = new ReportService();
export default reportService;
