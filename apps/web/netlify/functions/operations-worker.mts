import nodemailer from 'nodemailer';

import { config as applicationConfig } from '../../src/lib/server/config.ts';
import { database } from '../../src/lib/server/database.ts';
import { runWorker } from '../../src/lib/server/worker.ts';

function smtpFailure(error: unknown) {
  const value = typeof error === 'object' && error ? error as Record<string, unknown> : {};
  const safe = (field: string) => typeof value[field] === 'string' ? String(value[field]).slice(0, 80) : undefined;
  return {
    event: 'smtp_delivery_failed',
    code: safe('code'),
    command: safe('command'),
    responseCode: typeof value.responseCode === 'number' ? value.responseCode : undefined,
  };
}

export default async function operationsWorker() {
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
    throw new Error('SMTP_URL and MAIL_FROM are required.');
  }

  const settings = applicationConfig();
  const smtpUrl = new URL(process.env.SMTP_URL);
  smtpUrl.searchParams.set('connectionTimeout', '5000');
  smtpUrl.searchParams.set('socketTimeout', '3000');
  const transport = nodemailer.createTransport(smtpUrl.toString(), {
    from: process.env.MAIL_FROM,
  });

  try {
    // Netlify scheduled functions have a 30-second limit. Five deliveries per
    // cycle keeps a slow mail provider bounded; remaining mail retries on the
    // next five-minute cycle.
    const result = await runWorker(
      database(),
      settings.outboxKey,
      settings.origin,
      async (mail) => {
        try { return await transport.sendMail(mail); }
        catch (error) {
          // Log only SMTP protocol metadata. Never log the recipient, message,
          // provider response text or credentials.
          console.error(JSON.stringify(smtpFailure(error)));
          throw error;
        }
      },
      5,
    );
    console.log(JSON.stringify({ event: 'scheduled_worker_cycle', ...result }));
  } catch {
    console.error(JSON.stringify({ event: 'scheduled_worker_failed' }));
    throw new Error('The scheduled Fendor operation failed.');
  } finally {
    transport.close();
  }
}

export const config = {
  schedule: '*/5 * * * *',
};
