import axios from 'axios';
// @ts-ignore
import * as nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SMSPayload {
  phone: string;
  message: string;
}

export interface PushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface WebhookPayload {
  url: string;
  event: string;
  data: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (process.env.USE_SENDGRID) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY || '',
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@greenfinHub.io',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendBatch(payloads: EmailPayload[]): Promise<Array<{ success: boolean; error?: string }>> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}

export class SMSService {
  private africasTalkingApiKey: string;
  private twilioApiKey: string;
  private twilioAccountSid: string;

  constructor() {
    this.africasTalkingApiKey = process.env.AFRICAS_TALKING_API_KEY || '';
    this.twilioApiKey = process.env.TWILIO_AUTH_TOKEN || '';
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
  }

  async send(payload: SMSPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      return await this.sendWithAtlantic(payload);
    } catch (error) {
      console.warn('Africa\'s Talking failed, trying Twilio fallback:', error);
      return this.sendWithTwilio(payload);
    }
  }

  private async sendWithAtlantic(payload: SMSPayload) {
    try {
      const response = await axios.post(
        'https://api.sandbox.africastalking.com/version1/messaging',
        {
          username: process.env.AFRICAS_TALKING_USERNAME,
          ApiKey: this.africasTalkingApiKey,
          recipients: [{ phoneNumber: payload.phone, message: payload.message }],
        },
      );
      return { success: response.status === 200, messageId: response.data.SMSMessageData?.Recipients?.[0]?.messageId };
    } catch (error) {
      throw error;
    }
  }

  private async sendWithTwilio(payload: SMSPayload) {
    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
        {
          From: process.env.TWILIO_PHONE_NUMBER,
          To: payload.phone,
          Body: payload.message,
        },
        {
          auth: {
            username: this.twilioAccountSid,
            password: this.twilioApiKey,
          },
        },
      );
      return { success: response.status === 201, messageId: response.data.sid };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendBatch(payloads: SMSPayload[]): Promise<Array<{ success: boolean; error?: string }>> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}

export class PushService {
  private fcmServerKey: string;

  constructor() {
    this.fcmServerKey = process.env.FCM_SERVER_KEY || '';
  }

  async send(payload: PushPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.fcmServerKey) {
      return { success: false, error: 'FCM_SERVER_KEY not configured' };
    }

    try {
      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        {
          to: payload.deviceToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
        },
        {
          headers: {
            Authorization: `key=${this.fcmServerKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return { success: response.status === 200, messageId: response.data.message_id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendBatch(payloads: PushPayload[]): Promise<Array<{ success: boolean; error?: string }>> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}

export class WebhookService {
  async send(payload: WebhookPayload): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    try {
      const response = await axios.post(payload.url, {
        event: payload.event,
        data: payload.data,
        timestamp: new Date().toISOString(),
      });
      return { success: response.status >= 200 && response.status < 300, statusCode: response.status };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendBatch(payloads: WebhookPayload[]): Promise<Array<{ success: boolean; error?: string }>> {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}

export const emailService = new EmailService();
export const smsService = new SMSService();
export const pushService = new PushService();
export const webhookService = new WebhookService();
