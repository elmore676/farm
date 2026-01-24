import { PrismaClient, Role, CycleStatus, PayoutStatus, WaterAlertLevel, CageStatus, EquipmentStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@aquaflow.com';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin',
      email: adminEmail,
      passwordHash: await hashPassword('admin123'),
      role: Role.admin,
    },
  });

  const investor = await prisma.investor.create({
    data: {
      name: 'Investor One',
      email: 'investor@demo.com',
      phone: '+254700000000',
    },
  });

  const cage = await prisma.cage.create({
    data: {
      name: 'Cage Alpha',
      location: 'Lake Site A',
      lat: -1.2921,
      lng: 36.8219,
      locationLabel: 'Lake Victoria - North',
      capacity: 5000,
      currentStock: 4200,
      status: CageStatus.active,
      equipment: {
        create: [
          {
            name: 'Feeder 1',
            type: 'Automatic Feeder',
            status: EquipmentStatus.operational,
            lastMaintenance: new Date('2026-02-01'),
            nextMaintenance: new Date('2026-03-01'),
          },
          {
            name: 'Aerator 1',
            type: 'Aerator',
            status: EquipmentStatus.maintenance,
            lastMaintenance: new Date('2026-01-20'),
            nextMaintenance: new Date('2026-02-20'),
          },
        ],
      },
    },
  });

  // IoT seed: device, readings, thresholds, aggregations, alerts
  const device = await prisma.ioTDevice.create({
    data: {
      name: 'WQ Sensor Alpha',
      cageId: cage.id,
      deviceType: 'water-quality',
      serialNumber: 'WQ-ALPHA-001',
      apiKey: 'demo-api-key-1',
      status: 'online',
      firmwareVersion: '1.0.3',
      lastSeen: new Date(),
      batteryLevel: 87,
      signalStrength: -65,
      sensorTypes: ['temperature', 'pH', 'dissolvedOxygen'],
      isActive: true,
      config: { reportingInterval: 60, timezone: 'UTC' },
      readings: {
        create: [
          {
            cageId: cage.id,
            sensorType: 'temperature',
            value: 25.8,
            unit: 'C',
            quality: 'good',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            receivedAt: new Date(),
          },
          {
            cageId: cage.id,
            sensorType: 'pH',
            value: 7.15,
            unit: 'pH',
            quality: 'good',
            timestamp: new Date(Date.now() - 4 * 60 * 1000),
            receivedAt: new Date(),
          },
          {
            cageId: cage.id,
            sensorType: 'dissolvedOxygen',
            value: 6.7,
            unit: 'mg/L',
            quality: 'good',
            timestamp: new Date(Date.now() - 3 * 60 * 1000),
            receivedAt: new Date(),
          },
        ],
      },
      calibrations: {
        create: {
          sensorType: 'pH',
          calibrationType: 'multipoint',
          referenceValue: 7.0,
          measuredValue: 7.02,
          slope: 1,
          intercept: 0,
          coefficient: 1,
          driftDetected: false,
          nextDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          notes: 'Initial deployment calibration',
        },
      },
      configurations: {
        create: {
          readingInterval: 60,
          reportingInterval: 60,
          samplesPerReading: 5,
          timezone: 'UTC',
          ntp_server: 'pool.ntp.org',
          wifiSsid: 'farm-iot',
          enableDebug: false,
          config: { mode: 'normal' },
          appliedAt: new Date(),
        },
      },
    },
  });

  const thresholds = await prisma.alertThreshold.createMany({
    data: [
      {
        cageId: cage.id,
        sensorType: 'temperature',
        parameter: 'temperature',
        minValue: 22,
        maxValue: 29,
        severity: 'warning',
        cooldownMinutes: 30,
        enabled: true,
      },
      {
        cageId: cage.id,
        sensorType: 'dissolvedOxygen',
        parameter: 'dissolvedOxygen',
        minValue: 5.5,
        maxValue: 8.5,
        severity: 'warning',
        cooldownMinutes: 20,
        enabled: true,
      },
    ],
  });

  await prisma.sensorAggregation.create({
    data: {
      cageId: cage.id,
      sensorType: 'temperature',
      period: 'minute',
      periodStart: new Date(Date.now() - 10 * 60 * 1000),
      periodEnd: new Date(),
      value_avg: 25.9,
      value_min: 25.4,
      value_max: 26.1,
      value_stddev: 0.2,
      percentile_25: 25.6,
      percentile_50: 25.9,
      percentile_75: 26.0,
      percentile_95: 26.1,
      percentile_99: 26.1,
      readingCount: 12,
      qualityScore: 98,
    },
  });

  await prisma.ioTAlert.create({
    data: {
      cageId: cage.id,
      deviceId: device.id,
      alertType: 'threshold_violation',
      severity: 'warning',
      sensorType: 'temperature',
      parameter: 'temperature',
      currentValue: 26.2,
      threshold: 26,
      message: 'Water temperature trending high',
      isActive: true,
      cooldownUntil: new Date(Date.now() + 20 * 60 * 1000),
      metadata: { window: 'last 10m' },
    },
  });

  const cycle = await prisma.cycle.create({
    data: {
      cageId: cage.id,
      species: 'Tilapia',
      startDate: new Date('2025-10-01'),
      endDate: new Date(),
      status: CycleStatus.completed,
      initialStock: 5000,
      harvestedStock: 4700,
      mortality: 200,
      fcr: 1.4,
      biomassEnd: 4200,
      profit: 250000,
    },
  });

  await prisma.investment.create({
    data: {
      investorId: investor.id,
      cageId: cage.id,
      amount: 500000,
      roiPercent: 12,
      startDate: new Date(),
      status: 'active',
    },
  });

  await prisma.feedStock.create({ data: { feedType: 'Grower 32%', quantityKg: 1200, costPerKg: 120, supplierName: 'Lake Feeds' } });
  await prisma.feedUsage.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, feedType: 'Grower 32%', quantityKg: 200, date: new Date(), time: '08:00' },
      { cageId: cage.id, cycleId: cycle.id, feedType: 'Grower 32%', quantityKg: 150, date: new Date(), time: '16:00' },
    ],
  });

  await prisma.waterQuality.create({
    data: {
      cageId: cage.id,
      cycleId: cycle.id,
      recordedAt: new Date(),
      temperature: 26,
      ph: 7.2,
      dissolvedOxygen: 6.5,
      ammonia: 0.02,
      nitrite: 0.05,
      nitrate: 15,
      turbidity: 22,
      source: 'iot',
      notes: 'Baseline reading',
      alertLevel: WaterAlertLevel.normal,
    },
  });

  // Finance seed: revenue, expenses, budget
  await prisma.revenue.create({
    data: {
      cageId: cage.id,
      cycleId: cycle.id,
      type: 'fish_sale',
      amount: 1200000,
      quantityKg: 4200,
      pricePerKg: 285,
      occurredAt: new Date(),
    },
  });

  await prisma.expense.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, category: 'feed', amount: 350000, description: 'Grower feed', incurredAt: new Date() },
      { cageId: cage.id, cycleId: cycle.id, category: 'labor', amount: 120000, description: 'Farm hands', incurredAt: new Date() },
      { cageId: cage.id, cycleId: cycle.id, category: 'fingerlings', amount: 90000, description: 'Initial stocking', incurredAt: new Date() },
      { cageId: cage.id, cycleId: cycle.id, category: 'utilities', amount: 40000, description: 'Power and water', incurredAt: new Date() },
    ],
  });

  await prisma.budgetAllocation.createMany({
    data: [
      { cageId: cage.id, cycleId: cycle.id, category: 'feed', allocated: 400000, spent: 350000 },
      { cageId: cage.id, cycleId: cycle.id, category: 'labor', allocated: 150000, spent: 120000 },
      { cageId: cage.id, cycleId: cycle.id, category: 'fingerlings', allocated: 90000, spent: 90000 },
      { cageId: cage.id, cycleId: cycle.id, category: 'utilities', allocated: 60000, spent: 40000 },
      { cageId: cage.id, cycleId: cycle.id, category: 'operations', allocated: 80000, spent: 50000 },
    ],
  });

  await prisma.payout.create({
    data: {
      investorId: investor.id,
      cycleId: cycle.id,
      amount: 100000,
      status: PayoutStatus.pending,
    },
  });

  console.log('Seeded admin, investor, cage, cycle, feed, water quality, payout.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
