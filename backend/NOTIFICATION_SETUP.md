# Notification System Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install bullmq axios nodemailer
```

### 2. Configure Environment Variables

Copy and update `.env` with notification service credentials:

```env
# Email Service
USE_SENDGRID=true
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
EMAIL_FROM=noreply@greenfinHub.io

# OR (Gmail/SMTP)
USE_SENDGRID=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# SMS Service
AFRICAS_TALKING_API_KEY=atsk_xxx
AFRICAS_TALKING_USERNAME=your_username
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Push Notifications
FCM_SERVER_KEY=AAAA...

# Redis (for BullMQ queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 3. Set Up Database

```bash
# Create migration
npm run prisma:migrate -- --name add_notifications

# Or if database exists
npm run prisma:migrate deploy

# Seed templates
npm run prisma:seed
```

### 4. Start Redis

```bash
# Docker
docker run -d -p 6379:6379 redis:latest

# Or local Redis
redis-server
```

### 5. Start Backend

```bash
npm run dev
```

The queue worker will start automatically.

## Service Credentials Setup

### SendGrid Email

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Create API key (Settings → API Keys → Create)
3. Add to `.env`:
   ```env
   USE_SENDGRID=true
   SENDGRID_API_KEY=SG.xxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Africa's Talking SMS

1. Register at [africastalking.com](https://africastalking.com)
2. Get API Key from dashboard
3. Add to `.env`:
   ```env
   AFRICAS_TALKING_API_KEY=atsk_xxxx
   AFRICAS_TALKING_USERNAME=your_username
   ```

### Twilio SMS (Fallback)

1. Create account at [twilio.com](https://twilio.com)
2. Get credentials from console
3. Add phone number (or lease one)
4. Add to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### Firebase Cloud Messaging (FCM)

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Go to Project Settings → Service Accounts
3. Generate private key (JSON file)
4. Extract `server_key` or use REST API:
   ```env
   FCM_SERVER_KEY=your_server_key_here
   ```

## Testing

### Run Unit Tests

```bash
npm test -- src/tests/notification.service.test.ts
```

### Test via API

```bash
# 1. Get auth token
TOKEN=$(curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.data.accessToken')

# 2. Send test notification
curl -X POST http://localhost:4000/api/v1/notifications/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system_update",
    "channels": ["in_app", "email"]
  }'

# 3. Get notifications
curl -X GET http://localhost:4000/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN"

# 4. Get preferences
curl -X GET http://localhost:4000/api/v1/notifications/preferences \
  -H "Authorization: Bearer $TOKEN"

# 5. Update preferences
curl -X PUT http://localhost:4000/api/v1/notifications/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "channels": ["email", "sms"],
    "frequency": "immediate",
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }'
```

## Monitoring

### Check Queue Status

```bash
# Install bullmq dashboard (optional)
npm install @bull-board/express @bull-board/ui

# Access at http://localhost:4000/admin/queues
```

### Check Database

```bash
# View pending notifications
npx prisma studio

# Query pending deliveries
SELECT * FROM "NotificationDelivery" WHERE status = 'pending' ORDER BY "createdAt" DESC LIMIT 20;

# Check failed deliveries
SELECT * FROM "NotificationDelivery" WHERE status = 'failed' ORDER BY "createdAt" DESC LIMIT 20;
```

### View Logs

```bash
# Check Redis queue
redis-cli
> KEYS "bull:notifications:*"
> HGETALL bull:notifications:1

# Check error logs in application
tail -f logs/error.log
```

## Integration Points

### Water Quality Monitoring

```typescript
import { handleWaterQualityCheck } from '../services/notification-integration-examples';

// In your water quality controller
const log = await handleWaterQualityCheck(cageId, {
  temperature: 26,
  ph: 7.5,
  dissolvedOxygen: 6.2,
  ammonia: 0.02,
  nitrite: 0.05,
  nitrate: 20,
});
```

### Cycle Monitoring

```typescript
import { handleDailyLogWithMortalityCheck } from '../services/notification-integration-examples';

// After recording daily log
await handleDailyLogWithMortalityCheck(cycleId, mortalityCount, initialStock);
```

### Feed Management

```typescript
import { handleFeedStockUpdate } from '../services/notification-integration-examples';

// After feed usage
await handleFeedStockUpdate('Grower 32%', 450, 120);
```

### Financial Payouts

```typescript
import { NotificationTriggers } from '../services/notification-triggers.service';

// After payout processed
await NotificationTriggers.triggerPayoutNotification(
  investorId,
  amount,
  cageName,
  roi,
  'processed'
);
```

## Troubleshooting

### Notifications Not Sending

1. **Check Redis connection**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check queue status**
   ```
   GET /api/v1/notifications/stats
   ```

3. **Check delivery logs**
   ```bash
   SELECT * FROM "NotificationDelivery" 
   WHERE "notificationId" = 'your-id'
   ORDER BY "createdAt" DESC;
   ```

4. **Check application logs**
   - Look for "Failed to deliver" errors
   - Verify service credentials in `.env`

### Email Not Delivering

- Verify SendGrid/SMTP credentials
- Check sender email is verified in SendGrid
- Look for bounce logs in SendGrid dashboard
- Check spam folder (add to whitelist)

### SMS Not Delivering

- Verify Africa's Talking credentials and account balance
- Check phone number format (+254...)
- Try Twilio fallback if A.T. fails
- Check SMS character limits (160 chars standard)

### High Memory Usage

- Check Redis memory:
  ```bash
  redis-cli INFO memory
  ```
- Clean up old notifications:
  ```typescript
  import { cleanupOldNotifications } from '../services/queue.service';
  await cleanupOldNotifications();
  ```

## Performance Optimization

### Rate Limiting

Add rate limiting per channel in `.env`:

```env
EMAIL_RATE_LIMIT=100 # per hour per user
SMS_RATE_LIMIT=20
PUSH_RATE_LIMIT=50
```

### Batch Processing

For digest emails (daily/weekly):

```typescript
// Implement batch job processor
const batchNotifications = await prisma.notification.findMany({
  where: {
    recipientId: userId,
    type: 'system_update',
    createdAt: { gte: oneDayAgo },
  },
});

// Send single digest email with all updates
```

### Scheduled Delivery

Queue notifications for future delivery:

```typescript
await notificationService.sendNotification(payload, {
  userId,
  channels,
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
});
```

## Production Checklist

- [ ] Redis deployed and secured
- [ ] All service credentials configured
- [ ] Database migrations applied
- [ ] Template seeds loaded
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Monitoring dashboard set up
- [ ] Backup strategy for notifications
- [ ] Health checks implemented
- [ ] Load testing completed

## Support

For issues or questions:
- Check logs: `npm run logs`
- Test connectivity: `npm run test:notifications`
- Review NOTIFICATION_SYSTEM.md for detailed docs
