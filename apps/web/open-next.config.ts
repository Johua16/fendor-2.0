import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Fendora's marketplace pages are request-driven.  Do not introduce a paid
// cache product during the pilot.  Persistent cache and queue choices remain
// an explicit post-pilot infrastructure decision.
export default {
  ...defineCloudflareConfig(),
  // The pilot uses no persistent incremental cache.  This avoids requiring R2
  // or KV and works around a Next 16 standalone-manifest incompatibility in
  // the cache packager.  It is deliberately a safe performance trade-off for
  // a protected, low-traffic pilot.
  dangerous: { disableIncrementalCache: true },
};
