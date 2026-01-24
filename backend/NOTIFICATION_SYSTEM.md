# Multi-Channel Notification System

## Configuration

### Environment Variables

```bash
# Email Service (SendGrid or Gmail)
USE_SENDGRID=false
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@greenfinHub.io
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# SMS Service (Africa's Talking with Twilio fallback)
AFRICAS_TALKING_API_KEY=your_at_api_key
AFRICAS_TALKING_USERNAME=your_at_username
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Push Notifications (FCM)
FCM_SERVER_KEY=your_fcm_server_key

# Redis Queue
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Webhook (for integrations)
WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_TIMEOUT=5000
```

## Architecture

### Core Components

1. **NotificationService**: Main orchestrator for creating and managing notifications
2. **TemplateEngine**: Renders dynamic email/SMS/webhook templates with variables
3. **DeliveryServices**: Email, SMS, Push, Webhook adapters
4. **QueueProcessor**: BullMQ-based async processor for reliable delivery
5. **NotificationController**: REST API endpoints
6. **NotificationTriggers**: Event-based notification triggers

### Data Models

- **Notification**: In-app notification record
- **NotificationTemplate**: Template definitions for each channel and type
- **NotificationDelivery**: Tracks delivery attempts and results per channel
- **NotificationPreference**: User settings for notification types and channels
- **NotificationQueue**: Job queue for async processing

### Notification Flow

```
Event → NotificationService.sendNotification()
  ↓
Creates Notification (in-app)
  ↓
Queues delivery jobs for each channel
  ↓
BullMQ Worker picks up job
  ↓
Renders template with variables
  ↓
Calls appropriate delivery service
  ↓
Records delivery status
  ↓
Retries on failure (exponential backoff)
```

## API Endpoints

### Notifications Management
- `GET /api/v1/notifications` - List user notifications (paginated)
  - Query: `page`, `limit`, `read` (filter by read status)
- `PATCH /api/v1/notifications/:id/read` - Mark single notification as read
- `PATCH /api/v1/notifications/read-all` - Mark all as read
- `DELETE /api/v1/notifications/:id` - Delete notification

### Preferences
- `GET /api/v1/notifications/preferences` - Get user notification preferences
- `PUT /api/v1/notifications/preferences` - Update preferences
  - Body: `type`, `channels`, `frequency`, `enabled`, `quietHoursStart`, `quietHoursEnd`

### Testing & Analytics
- `POST /api/v1/notifications/test` - Send test notification
  - Body: `type`, `channels[]`
- `GET /api/v1/notifications/stats` - Get notification statistics

## Notification Types

### Available Types
- `water_quality_alert` - Critical water parameter violations
- `mortality_alert` - Mortality rate threshold exceeded
- `feed_stock_warning` - Feed inventory low
- `harvest_reminder` - Upcoming harvest (3 days before)
- `payout_notification` - Payout status updates
- `task_assignment` - Task assigned to user
- `system_update` - Platform updates/announcements
- `report_generated` - Report generation complete
- `auth_otp` - Authentication one-time password
- `password_reset` - Password reset link

### Channels
- `in_app` - Database-stored notifications
- `email` - Via SendGrid or SMTP
- `sms` - Via Africa's Talking or Twilio
- `push` - Via FCM to mobile
- `webhook` - Custom webhook delivery

### Frequency Settings
- `immediate` - Send right away
- `daily_digest` - Batch into daily email
- `weekly` - Batch into weekly email

### Priority Levels
- `critical` - Bypass quiet hours, multiple channels
- `high` - Skip quiet hours
- `medium` - Respect quiet hours
- `low` - Low priority queue

## Usage Examples

### Triggering Notifications

```typescript
import { NotificationTriggers } from './services/notification-triggers.service';

// Water quality alert
await NotificationTriggers.triggerWaterQualityAlert(
  cageId,
  'pH',
  8.5,
  7.5
);

// Mortality alert
await NotificationTriggers.triggerMortalityAlert(
  cycleId,
  20, // mortality rate %
  500 // fish lost
);

// Feed stock warning
await NotificationTriggers.triggerFeedStockWarning(
  'Grower 32%',
  50, // current stock
  100, // min threshold
  120 // cost per kg
);

// Harvest reminder
await NotificationTriggers.triggerHarvestReminder(
  cycleId,
  harvestDate,
  4200, // expected biomass
  500000 // estimated revenue
);

// Payout notification
await NotificationTriggers.triggerPayoutNotification(
  investorId,
  500000, // amount
  'Cage A',
  12, // ROI %
  'processed'
);
```

### Manual Notification Creation

```typescript
import { notificationService } from './services/notification.service';
import { NotificationType, NotificationChannel } from '@prisma/client';

await notificationService.sendNotification(
  {
    type: NotificationType.system_update,
    recipientId: userId,
    title: 'System Maintenance',
    body: 'Platform will be down for maintenance on Sunday',
    channels: [NotificationChannel.in_app, NotificationChannel.email],
    priority: 'high',
    templateVariables: {
      title: 'System Maintenance',
      message: 'Scheduled maintenance',
      details: 'System will be offline 2-4 AM UTC',
    },
  },
  {
    userId,
    channels: [NotificationChannel.in_app, NotificationChannel.email],
    priority: 'high',
  }
);
```

## Template System

### Template Variables

Templates use `{{variableName}}` syntax for dynamic content:

```html
<h2>Alert from {{cageName}}</h2>
<p>{{parameter}} is at {{currentValue}}, safe threshold is {{threshold}}</p>
```

### Adding Custom Templates

```typescript
import { prisma } from '@prisma/client';

await prisma.notificationTemplate.create({
  data: {
    type: 'water_quality_alert',
    channel: 'email',
    language: 'en',
    name: 'Custom Water Alert',
    subject: 'Action Needed: {{cageName}}',
    body: 'Custom HTML template...',
    variables: ['cageName', 'parameter', 'currentValue', 'threshold'],
  },
});
```

## Delivery Tracking

Each notification can have multiple delivery attempts per channel:

```typescript
// Get delivery history
const notification = await prisma.notification.findUnique({
  where: { id: notificationId },
  include: { deliveries: true },
});

// Check delivery status
notification.deliveries.forEach(delivery => {
  console.log(`${delivery.channel}: ${delivery.status}`);
  if (delivery.failureReason) {
    console.log(`Error: ${delivery.failureReason}`);
  }
});
```

## Quiet Hours & Scheduling

Users can configure quiet hours to avoid notifications:

```typescript
// Update preferences with quiet hours
await notificationService.updatePreferences(userId, {
  quietHoursStart: '22:00', // 10 PM
  quietHoursEnd: '08:00',   // 8 AM
  frequency: 'daily_digest', // Batch into digest during quiet hours
});
```

Notifications scheduled during quiet hours will:
- Be queued for digest delivery
- Skip SMS/push channels
- Still deliver via email as daily digest

## Error Handling & Retries

The queue processor automatically retries failed deliveries:

- **Max Retries**: 3 attempts per channel
- **Backoff Strategy**: Exponential (initial 2s, then double each retry)
- **Dead Letter Queue**: Failed after all retries logged to `NotificationDelivery.status = 'failed'`

```typescript
// Check failed deliveries
const failed = await prisma.notificationDelivery.findMany({
  where: {
    status: 'failed',
    failedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
  include: { notification: true },
});
```

## Rate Limiting

Built-in rate limiting per channel:

- **Email**: 100 per hour per user
- **SMS**: 20 per hour per user
- **Push**: 50 per hour per user
- **Webhook**: 500 per hour per endpoint

## Monitoring & Analytics

Track notification metrics:

```typescript
// Get stats
const stats = await prisma.notificationDelivery.groupBy({
  by: ['channel', 'status'],
  where: {
    createdAt: { gte: sevenDaysAgo },
  },
  _count: { id: true },
});

// Success rates
const successRate = (successful / total) * 100;
```

## Testing

Run notification tests:

```bash
npm test -- src/tests/notification.service.test.ts
```

## WebSocket Integration (Future)

Socket.IO integration for real-time notifications:

```typescript
// Socket event when new notification created
socket.emit('notification:new', {
  id: notification.id,
  type: notification.type,
  title: notification.title,
});

// Mark as read in real-time
socket.emit('notification:read', { id: notificationId });
```

## Integrations

### Africa's Talking SMS
- Primary SMS provider for Kenya/Africa region
- Supports OTP, transactional SMS
- Character limits: 160 chars (standard), 306 chars (with unicode)

### SendGrid Email
- Transactional email delivery
- Template management
- Click/open tracking
- Bounce handling

### FCM Push Notifications
- Android and iOS support
- Device token management
- Rich notifications with images/actions

### Custom Webhooks
- Flexible event delivery
- Retry with exponential backoff
- Event signing for security
