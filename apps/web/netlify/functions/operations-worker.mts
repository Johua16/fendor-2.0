import { config as applicationConfig } from '../../src/lib/server/config.ts';
import { database } from '../../src/lib/server/database.ts';
import { runWorker } from '../../src/lib/server/worker.ts';
import { mailReplyContacts } from '../../src/lib/server/mail-config.ts';
import {createEmailTransport,emailProviderConfigured} from '../../src/lib/server/email-provider.ts';

export default async function operationsWorker() {
  if (!emailProviderConfigured()) {
    throw new Error('Email delivery provider is not configured.');
  }

  const settings = applicationConfig();
  const transport = createEmailTransport();

  try {
    // Netlify scheduled functions have a 30-second limit. Five deliveries per
    // cycle keeps a slow mail provider bounded; remaining mail retries on the
    // next five-minute cycle.
    const result = await runWorker(
      database(),
      settings.outboxKey,
      settings.origin,
      async (mail) => transport.send(mail),
      5,
      true,
      mailReplyContacts(),
      transport.policy,
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
