import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

export const NOTIFICATION_TEMPLATES = [
  {
    type: 'water_quality_alert',
    channel: 'email',
    language: 'en',
    name: 'Water Quality Alert',
    subject: 'Critical: Water Quality Alert for {{cageName}}',
    body: `
<h2>Water Quality Alert - {{cageName}}</h2>
<p>A critical water quality threshold has been exceeded.</p>
<ul>
  <li><strong>Parameter:</strong> {{parameter}}</li>
  <li><strong>Current Value:</strong> {{currentValue}}</li>
  <li><strong>Safe Threshold:</strong> {{threshold}}</li>
  <li><strong>Cage:</strong> {{cageName}}</li>
  <li><strong>Time:</strong> {{timestamp}}</li>
</ul>
<p><strong>Recommended Actions:</strong></p>
<p>{{recommendedActions}}</p>
<p>Please log in immediately to view more details and take corrective action.</p>
    `,
    variables: ['cageName', 'parameter', 'currentValue', 'threshold', 'timestamp', 'recommendedActions'],
  },
  {
    type: 'water_quality_alert',
    channel: 'sms',
    language: 'en',
    name: 'Water Quality SMS Alert',
    body: 'ALERT {{cageName}}: {{parameter}} at {{currentValue}} exceeds safe {{threshold}}. Action needed!',
    variables: ['cageName', 'parameter', 'currentValue', 'threshold'],
  },
  {
    type: 'mortality_alert',
    channel: 'email',
    language: 'en',
    name: 'Mortality Alert Email',
    subject: 'Mortality Alert: {{cageName}} - Mortality Rate {{mortalityRate}}%',
    body: `
<h2>Mortality Alert - {{cageName}}</h2>
<p>The mortality rate has exceeded safe thresholds.</p>
<ul>
  <li><strong>Cage:</strong> {{cageName}}</li>
  <li><strong>Current Mortality Rate:</strong> {{mortalityRate}}%</li>
  <li><strong>Threshold:</strong> {{threshold}}%</li>
  <li><strong>Fish Lost:</strong> {{fishLost}}</li>
  <li><strong>Recorded:</strong> {{timestamp}}</li>
</ul>
<p>Please investigate immediately and implement corrective measures.</p>
    `,
    variables: ['cageName', 'mortalityRate', 'threshold', 'fishLost', 'timestamp'],
  },
  {
    type: 'feed_stock_warning',
    channel: 'email',
    language: 'en',
    name: 'Feed Stock Warning',
    subject: 'Low Stock Alert: {{feedType}}',
    body: `
<h2>Feed Stock Low - {{feedType}}</h2>
<p>Your feed stock is running low.</p>
<ul>
  <li><strong>Feed Type:</strong> {{feedType}}</li>
  <li><strong>Current Stock:</strong> {{currentStock}}kg</li>
  <li><strong>Minimum Threshold:</strong> {{minThreshold}}kg</li>
  <li><strong>Cost per KG:</strong> {{costPerKg}}</li>
</ul>
<p>Consider placing a new order to avoid disruption to feeding schedules.</p>
    `,
    variables: ['feedType', 'currentStock', 'minThreshold', 'costPerKg'],
  },
  {
    type: 'harvest_reminder',
    channel: 'email',
    language: 'en',
    name: 'Harvest Reminder Email',
    subject: 'Harvest Reminder: {{cageName}} - {{daysUntilHarvest}} days remaining',
    body: `
<h2>Harvest Reminder - {{cageName}}</h2>
<p>Your scheduled harvest is approaching.</p>
<ul>
  <li><strong>Cage:</strong> {{cageName}}</li>
  <li><strong>Expected Harvest Date:</strong> {{harvestDate}}</li>
  <li><strong>Days Remaining:</strong> {{daysUntilHarvest}}</li>
  <li><strong>Expected Biomass:</strong> {{expectedBiomass}}kg</li>
  <li><strong>Estimated Revenue:</strong> {{estimatedRevenue}}</li>
</ul>
<p>Ensure all preparations are in place for a successful harvest.</p>
    `,
    variables: ['cageName', 'harvestDate', 'daysUntilHarvest', 'expectedBiomass', 'estimatedRevenue'],
  },
  {
    type: 'payout_notification',
    channel: 'email',
    language: 'en',
    name: 'Payout Notification',
    subject: 'Payout Processed: {{amount}} from {{cageName}}',
    body: `
<h2>Payout Notification</h2>
<p>Your payout has been processed successfully.</p>
<ul>
  <li><strong>Amount:</strong> {{amount}}</li>
  <li><strong>Cage/Cycle:</strong> {{cageName}}</li>
  <li><strong>ROI:</strong> {{roi}}%</li>
  <li><strong>Status:</strong> {{status}}</li>
  <li><strong>Date:</strong> {{timestamp}}</li>
</ul>
<p>The funds will be transferred to your registered bank account within 2-3 business days.</p>
    `,
    variables: ['amount', 'cageName', 'roi', 'status', 'timestamp'],
  },
  {
    type: 'system_update',
    channel: 'email',
    language: 'en',
    name: 'System Update Notification',
    subject: 'System Update: {{title}}',
    body: `
<h2>System Update - {{title}}</h2>
<p>{{message}}</p>
<p><strong>Update Details:</strong></p>
<p>{{details}}</p>
<p>For more information, please contact our support team.</p>
    `,
    variables: ['title', 'message', 'details'],
  },
];

export async function seedNotificationTemplates() {
  for (const template of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: {
        type_channel_language_isActive: {
          type: template.type,
          channel: template.channel,
          language: template.language,
          isActive: true,
        },
      },
      update: {
        body: template.body,
        subject: template.subject || null,
        variables: template.variables || [],
      },
      create: {
        type: template.type,
        channel: template.channel,
        language: template.language,
        name: template.name,
        body: template.body,
        subject: template.subject || null,
        variables: template.variables || [],
        isActive: true,
      },
    });
  }

  console.log('Notification templates seeded successfully');
}
