import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { PrismaClient, CycleStatus, ExpenseCategory, RevenueType } from '@prisma/client';
import { createApp } from '../app';
import { signAccessToken } from '../utils/tokens';

const prisma = new PrismaClient();
const app = createApp();
const request = supertest(app);

const authHeader = () => ({ Authorization: `Bearer ${signAccessToken({ sub: 'integration-admin', role: 'admin' })}` });

const ctx: {
  investorId?: string;
  cageId?: string;
  cycleId?: string;
} = {};

let skipIntegration = false;

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Revenue" LIMIT 1`;
  } catch (err) {
    skipIntegration = true;
    console.warn('Skipping finance route integration tests; prisma migrations not applied.', err);
    return;
  }

  const investor = await prisma.investor.create({ data: { name: 'Integration Investor', status: 'active', kycStatus: 'verified' } });
  const cage = await prisma.cage.create({ data: { name: 'Integration Cage', status: 'active' } });
  const cycle = await prisma.cycle.create({
    data: {
      cageId: cage.id,
      species: 'Tilapia',
      startDate: new Date('2025-08-01'),
      endDate: new Date('2025-12-01'),
      status: CycleStatus.completed,
      initialStock: 4000,
      harvestedStock: 3800,
      fcr: 1.5,
      biomassEnd: 3600,
      profit: 180000,
    },
  });

  await prisma.investment.create({ data: { investorId: investor.id, cageId: cage.id, amount: 300000, shareUnits: 3, unitPrice: 100000, roiPercent: 12, startDate: new Date('2025-08-01'), status: 'active' } });

  await prisma.revenue.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, type: RevenueType.fish_sale, amount: 500000, quantityKg: 2000, pricePerKg: 250, occurredAt: new Date('2025-11-15') },
      { cageId: cage.id, cycleId: cycle.id, type: RevenueType.byproduct, amount: 40000, occurredAt: new Date('2025-11-20') },
    ],
  });

  await prisma.expense.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, category: ExpenseCategory.feed, amount: 150000, description: 'Feed', incurredAt: new Date('2025-10-10') },
      { cageId: cage.id, cycleId: cycle.id, category: ExpenseCategory.labor, amount: 70000, description: 'Labor', incurredAt: new Date('2025-10-15') },
      { cageId: cage.id, cycleId: cycle.id, category: ExpenseCategory.utilities, amount: 30000, description: 'Power', incurredAt: new Date('2025-10-18') },
    ],
  });

  await prisma.budgetAllocation.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, category: ExpenseCategory.feed, allocated: 140000, spent: 150000 },
      { cageId: cage.id, cycleId: cycle.id, category: ExpenseCategory.labor, allocated: 80000, spent: 70000 },
    ],
  });

  await prisma.feedStock.create({ data: { feedType: 'Test Feed', quantityKg: 800, costPerKg: 100, supplierName: 'Test Supplier' } });
  await prisma.feedUsage.createMany({ data: [{ cageId: cage.id, cycleId: cycle.id, feedType: 'Test Feed', quantityKg: 100, date: new Date('2025-09-01') }] });

  ctx.investorId = investor.id;
  ctx.cageId = cage.id;
  ctx.cycleId = cycle.id;
});

after(async () => {
  if (skipIntegration) {
    await prisma.$disconnect();
    return;
  }
  await prisma.payout.deleteMany({ where: { cycleId: ctx.cycleId } });
  await prisma.feedUsage.deleteMany({ where: { cycleId: ctx.cycleId } });
  await prisma.feedStock.deleteMany({ where: { supplierName: 'Test Supplier' } });
  await prisma.budgetAllocation.deleteMany({ where: { cycleId: ctx.cycleId } });
  await prisma.expense.deleteMany({ where: { cycleId: ctx.cycleId } });
  await prisma.revenue.deleteMany({ where: { cycleId: ctx.cycleId } });
  await prisma.investment.deleteMany({ where: { cageId: ctx.cageId } });
  await prisma.cycle.deleteMany({ where: { id: ctx.cycleId } });
  await prisma.cage.deleteMany({ where: { id: ctx.cageId } });
  await prisma.investor.deleteMany({ where: { id: ctx.investorId } });
  await prisma.$disconnect();
});

test('P&L endpoint returns net profit', async () => {
  if (skipIntegration) return;
  const res = await request.get(`/api/v1/finance/pnl?cycleId=${ctx.cycleId}`).set(authHeader());
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.netProfit);
});

test('ROI endpoint returns roiPct', async () => {
  if (skipIntegration) return;
  const res = await request.get(`/api/v1/finance/investors/${ctx.investorId}/roi`).set(authHeader());
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.roiPct !== undefined);
});

test('Forecast endpoint returns profit forecast', async () => {
  if (skipIntegration) return;
  const res = await request.get(`/api/v1/finance/forecast/${ctx.cageId}`).set(authHeader());
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.forecastProfit !== undefined);
});

test('Cost analysis returns feed cost summary', async () => {
  if (skipIntegration) return;
  const res = await request.get(`/api/v1/finance/costs?cageId=${ctx.cageId}`).set(authHeader());
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.estimatedFeedCost);
});

test('Budget variance flags overspend', async () => {
  if (skipIntegration) return;
  const res = await request.get(`/api/v1/finance/budget/${ctx.cycleId}`).set(authHeader());
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body?.data?.overspent));
  assert.ok(res.body.data.overspent.length >= 1);
});

test('Distribute payouts creates payout records', async () => {
  if (skipIntegration) return;
  const res = await request
    .post(`/api/v1/finance/cycles/${ctx.cycleId}/payouts/distribute`)
    .set(authHeader())
    .send({ taxRatePct: 5 });
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.createdCount >= 1);
});
