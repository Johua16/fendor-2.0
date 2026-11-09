import type { MetadataRoute } from 'next';

const origin = process.env.APP_ORIGIN?.startsWith('https://')
  ? process.env.APP_ORIGIN.replace(/\/$/, '')
  : 'https://fendor-beta.netlify.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ['/', 'daily', 1],
    ['/shop', 'daily', 0.9],
    ['/help', 'monthly', 0.6],
    ['/policies/terms', 'monthly', 0.5],
    ['/policies/privacy', 'monthly', 0.5],
    ['/policies/refunds', 'monthly', 0.5],
    ['/policies/returns', 'monthly', 0.5],
    ['/policies/vendor-agreement', 'monthly', 0.4],
  ].map(([path, changeFrequency, priority]) => ({
    url: `${origin}${path}`,
    changeFrequency: changeFrequency as MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: priority as number,
  }));
}
