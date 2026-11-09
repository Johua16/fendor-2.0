import type { MetadataRoute } from 'next';

const origin = process.env.APP_ORIGIN?.startsWith('https://')
  ? process.env.APP_ORIGIN.replace(/\/$/, '')
  : 'https://fendor-beta.netlify.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/shop', '/product/', '/help', '/policies/'],
      disallow: ['/api/', '/account', '/admin', '/cart', '/forgot-password', '/login', '/notifications', '/orders', '/reset-password', '/review-access', '/saved', '/signup', '/support', '/vendor', '/verify-email'],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
