import prisma from '../lib/prisma';

function percentile(arr: number[], p: number) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

class AggregationService {
  private db = prisma as any;
  async aggregatePeriod(cageId: string, sensorType: string, period: 'minute' | 'hour' | 'day', from: Date, to: Date) {
    const readings = await this.db.sensorReading.findMany({
      where: {
        cageId,
        sensorType,
        timestamp: { gte: from, lte: to },
      },
      select: { value: true },
    });

    if (!readings.length) return null;

    const values = readings.map((r: { value: number }) => r.value);
    const count = values.length;
    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((acc: number, v: number) => acc + Math.pow(v - avg, 2), 0) / count;
    const stddev = Math.sqrt(variance);

    return this.db.sensorAggregation.upsert({
      where: { cageId_sensorType_period_periodStart: { cageId, sensorType, period, periodStart: from } },
      create: {
        cageId,
        sensorType,
        period,
        periodStart: from,
        periodEnd: to,
        value_avg: avg,
        value_min: min,
        value_max: max,
        value_stddev: stddev,
        percentile_25: percentile(values, 0.25) ?? undefined,
        percentile_50: percentile(values, 0.5) ?? undefined,
        percentile_75: percentile(values, 0.75) ?? undefined,
        percentile_95: percentile(values, 0.95) ?? undefined,
        percentile_99: percentile(values, 0.99) ?? undefined,
        readingCount: count,
        qualityScore: 100,
      },
      update: {
        periodEnd: to,
        value_avg: avg,
        value_min: min,
        value_max: max,
        value_stddev: stddev,
        percentile_25: percentile(values, 0.25) ?? undefined,
        percentile_50: percentile(values, 0.5) ?? undefined,
        percentile_75: percentile(values, 0.75) ?? undefined,
        percentile_95: percentile(values, 0.95) ?? undefined,
        percentile_99: percentile(values, 0.99) ?? undefined,
        readingCount: count,
        qualityScore: 100,
      },
    });
  }
}

export const aggregationService = new AggregationService();
export default aggregationService;
