import nodemailer from 'nodemailer';

import { config } from './config.ts';
import { database } from './database.ts';
import { drainMail } from './mail.ts';
import { produceNotifications } from './notifications.ts';

/**
 * Best-effort fast path for user-triggered communication. Durable records are
 * already committed before this runs; the scheduled worker remains the retry
 * path whenever SMTP is unavailable or this background task is interrupted.
 */
export async function flushPendingCommunications(limit=5) {
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) return { skipped: true as const };
  const settings = config();
  const db = database();
  const smtpUrl = new URL(process.env.SMTP_URL);
  smtpUrl.searchParams.set('connectionTimeout', '5000');
  smtpUrl.searchParams.set('socketTimeout', '8000');
  const transport = nodemailer.createTransport(smtpUrl.toString(), { from: process.env.MAIL_FROM });
  try {
    const notifications = await produceNotifications(db, settings.outboxKey, settings.origin);
    const delivery = await drainMail(db, settings.outboxKey, mail => transport.sendMail(mail), limit);
    if (delivery.failures) console.error(JSON.stringify({ event: 'immediate_mail_retry_scheduled', failures: delivery.failures }));
    return { skipped: false as const, notifications, ...delivery };
  } catch {
    // Never expose recipients, content or provider responses. The scheduled
    // worker will pick up every committed notification or outbox record.
    console.error(JSON.stringify({ event: 'immediate_communication_failed' }));
    return { skipped: false as const, sent: 0, failures: 1, suppressed: 0 };
  } finally {
    transport.close();
  }
}
