import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { notificationService, TemplateEngine } from '../services/notification.service';

const prisma = new PrismaClient() as any;
const templateEngine = new TemplateEngine();

test('NotificationService - createNotification creates in-app notification', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
      passwordHash: 'hash',
    },
  });

  const notification = await notificationService.createNotification({
    type: 'system_update',
    recipientId: user.id,
    title: 'Test Notification',
    body: 'This is a test',
    channels: ['in_app'],
  });

  assert.ok(notification.id);
  assert.equal(notification.title, 'Test Notification');
  assert.equal(notification.recipientId, user.id);
  assert.equal(notification.read, false);

  await prisma.user.delete({ where: { id: user.id } });
});

test('NotificationService - markAsRead marks notification as read', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
      passwordHash: 'hash',
    },
  });

  const notification = await notificationService.createNotification({
    type: 'system_update',
    recipientId: user.id,
    title: 'Test',
    body: 'Test body',
    channels: ['in_app'],
  });

  const marked = await notificationService.markAsRead(notification.id);

  assert.equal(marked.read, true);
  assert.ok(marked.readAt);

  await prisma.notification.delete({ where: { id: notification.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

test('NotificationService - getUserNotifications returns paginated list', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
      passwordHash: 'hash',
    },
  });

  for (let i = 0; i < 5; i++) {
    await notificationService.createNotification({
      type: 'system_update',
      recipientId: user.id,
      title: `Notification ${i}`,
      body: 'Test',
      channels: ['in_app'],
    });
  }

  const notifications = await notificationService.getUserNotifications(user.id, { take: 3 });

  assert.equal(notifications.length, 3);
  assert.ok(notifications[0].createdAt >= notifications[1].createdAt);

  await prisma.notification.deleteMany({ where: { recipientId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

test('TemplateEngine - renderTemplate replaces variables', async () => {
  const template = await prisma.notificationTemplate.create({
    data: {
      type: 'water_quality_alert',
      channel: 'email',
      language: 'en',
      name: 'Test Template',
      subject: 'Alert from {{cageName}}',
      body: 'Parameter {{parameter}} is at {{currentValue}}, threshold is {{threshold}}',
      variables: ['cageName', 'parameter', 'currentValue', 'threshold'],
    },
  });

  const rendered = await templateEngine.renderTemplate(
    'water_quality_alert',
    'email',
    {
      cageName: 'Cage A',
      parameter: 'pH',
      currentValue: '8.5',
      threshold: '7.5',
    },
    'en',
  );

  assert.ok(rendered.body.includes('pH is at 8.5'));
  assert.ok(rendered.body.includes('7.5'));

  await prisma.notificationTemplate.delete({ where: { id: template.id } });
});

test('NotificationService - updatePreferences saves user preferences', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
      passwordHash: 'hash',
    },
  });

  const prefs = await notificationService.updatePreferences(user.id, {
    enabled: true,
    channels: ['email', 'sms'],
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  assert.equal(prefs.enabled, true);
  assert.ok(prefs.channels.includes('email'));
  assert.equal(prefs.quietHoursStart, '22:00');

  await prisma.notificationPreference.delete({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

test('NotificationService - sendNotification queues delivery', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
      passwordHash: 'hash',
    },
  });

  const notification = await notificationService.sendNotification(
    {
      type: 'system_update',
      recipientId: user.id,
      title: 'Test',
      body: 'Test',
      channels: ['email'],
    },
    {
      userId: user.id,
      channels: ['email'],
      priority: 'medium',
    },
  );

  const queued = await prisma.notificationQueue.findMany({
    where: { userId: user.id },
  });

  assert.ok(queued.length > 0);

  await prisma.notificationQueue.deleteMany({ where: { userId: user.id } });
  await prisma.notification.delete({ where: { id: notification.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

