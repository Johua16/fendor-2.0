import { timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

import { config } from '@/lib/server/config';
import { database } from '@/lib/server/database';
import { runWorker } from '@/lib/server/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!secret || secret.length < 32 || supplied.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json(
      { error: { code: 'UNAUTHORISED', message: 'Worker access denied.' } },
      { status: 401 },
    );
  }

  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
    return Response.json(
      { error: { code: 'MAIL_NOT_CONFIGURED', message: 'Email delivery is not configured.' } },
      { status: 503 },
    );
  }

  const settings = config();
  const smtpUrl = new URL(process.env.SMTP_URL);
  smtpUrl.searchParams.set('connectionTimeout', '10000');
  smtpUrl.searchParams.set('socketTimeout', '15000');
  const transport = nodemailer.createTransport(smtpUrl.toString(), {
    from: process.env.MAIL_FROM,
  });

  try {
    const result = await runWorker(
      database(),
      settings.outboxKey,
      settings.origin,
      (mail) => transport.sendMail(mail),
    );

    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    console.error(JSON.stringify({ event: 'scheduled_worker_failed' }));
    return Response.json(
      { error: { code: 'WORKER_FAILED', message: 'The scheduled operation failed.' } },
      { status: 500 },
    );
  } finally {
    transport.close();
  }
}
