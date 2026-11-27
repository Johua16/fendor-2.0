import openNextWorker from '../.open-next/worker.js';

type Bindings = {
  CRON_SECRET?: string;
  WORKER_SELF_REFERENCE: Fetcher;
};

/**
 * Cloudflare Cron Triggers do not invoke Next route handlers directly.  This
 * thin wrapper reuses the existing protected worker endpoint, so the same
 * outbox, retry and audit behaviour runs on Netlify and Cloudflare.
 */
export default {
  fetch: openNextWorker.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) {
      console.error(JSON.stringify({ event: 'scheduled_worker_missing_secret' }));
      return;
    }
    const request = new Request('https://fendora-internal/api/internal/operations-worker', {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(env.WORKER_SELF_REFERENCE.fetch(request).then(async (response) => {
      if (!response.ok) console.error(JSON.stringify({ event: 'scheduled_worker_failed', status: response.status }));
    }).catch(() => console.error(JSON.stringify({ event: 'scheduled_worker_failed' }))));
  },
};
