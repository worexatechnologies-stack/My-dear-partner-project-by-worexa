import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const routes = ['', '/about', '/contact', '/membership', '/faq', '/help', '/privacy', '/terms'];
  return routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: 'monthly', priority: route === '' ? 1 : .7 }));
}
