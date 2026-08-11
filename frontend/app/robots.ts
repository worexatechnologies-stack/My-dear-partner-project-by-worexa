import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/about', '/contact', '/membership', '/faq', '/help'],
      disallow: ['/api/', '/admin/', '/super-admin/', '/staff/', '/support/', '/dashboard', '/profile/', '/search', '/messages', '/tickets', '/notifications', '/settings'],
    }],
    sitemap: `${base}/sitemap.xml`,
  };
}
