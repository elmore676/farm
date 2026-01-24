import { test } from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  computeProportionalPayouts,
  computeProfitLoss,
  computeROI,
  annualizeReturn,
  computeForecastFromCycles,
  computeBudgetVariance,
  computeFeedCostAnalysis,
  round2,
} from '../services/financial.service';

test('computeProportionalPayouts splits profit by units and applies tax', () => {
  const shares = [
    { investorId: 'a', units: new Decimal(1) },
    { investorId: 'b', units: new Decimal(3) },
  ];

  const result = computeProportionalPayouts(new Decimal(1000), shares, 10);

  assert.equal(result.length, 2);
  assert.ok(result[0].gross.equals(new Decimal(250)));
  assert.ok(result[0].net.equals(new Decimal(225)));
  assert.ok(result[1].gross.equals(new Decimal(750)));
  assert.ok(result[1].net.equals(new Decimal(675)));

  const totalNet = result.reduce((acc, r) => acc.plus(r.net), new Decimal(0));
  assert.ok(totalNet.equals(new Decimal(900)));
});

test('computeProfitLoss aggregates and produces margin', () => {
  const pl = computeProfitLoss({
    revenues: [new Decimal(1000), new Decimal(500)],
    directCosts: [new Decimal(600)],
    indirectCosts: [new Decimal(200)],
  });

  assert.ok(pl.revenue.equals(new Decimal(1500)));
  assert.ok(pl.grossProfit.equals(new Decimal(900)));
  assert.ok(pl.netProfit.equals(new Decimal(700)));
  assert.ok(pl.profitMargin.minus(new Decimal(46.67)).abs().lessThan(0.01));
});

test('computeROI calculates simple ROI and annualizes', () => {
  const { roiPct } = computeROI(new Decimal(1000), new Decimal(1250));
  assert.ok(roiPct.equals(new Decimal(25)));

  const annualized = annualizeReturn(roiPct, 90);
  assert.ok(annualized.greaterThan(25));
});

test('round2 uses half-up rounding', () => {
  assert.ok(round2(1.005).equals(new Decimal(1.01)));
  assert.ok(round2(1.004).equals(new Decimal(1)));
});

test('computeForecastFromCycles provides forecast and CI', () => {
  const computed = computeForecastFromCycles([
    { biomassEnd: 1000, fcr: 1.4, profit: 2000 },
    { biomassEnd: 900, fcr: 1.6, profit: 1800 },
  ]);

  assert.ok(computed);
  assert.ok(computed?.forecastProfit.greaterThan(0));
  assert.ok(computed?.assumptions.avgFcr.greaterThan(0));
});

test('computeBudgetVariance flags overspend', () => {
  const { variance, overspent } = computeBudgetVariance([
    { category: 'feed' as any, allocated: 1000, spent: 1200 },
    { category: 'labor' as any, allocated: 500, spent: 400 },
  ]);

  assert.equal(variance.length, 2);
  assert.equal(overspent.length, 1);
  assert.equal(overspent[0].category, 'feed');
});

test('computeFeedCostAnalysis aggregates feed usage cost', () => {
  const result = computeFeedCostAnalysis(
    [
      { feedType: 'A', quantityKg: 100 },
      { feedType: 'B', quantityKg: 50 },
    ],
    [
      { feedType: 'A', costPerKg: 2 },
      { feedType: 'A', costPerKg: 4 },
      { feedType: 'B', costPerKg: 3 },
    ],
  );

  assert.ok(result.totalFeedUsedKg.equals(new Decimal(150)));
  assert.ok(result.estimatedFeedCost.greaterThan(0));
  assert.equal(result.feedCostPerType.length, 2);
});
