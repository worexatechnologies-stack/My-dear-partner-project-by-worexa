/**
 * Build a public, user-friendly profile URL from any profile-like object.
 *
 * Prefers the unique `profile_slug` and falls back to the internal id so
 * existing callers never break even if a payload predates slugs.
 */
export function profileHref(payload: unknown): string {
  const item = (payload ?? {}) as Record<string, any>;
  const slug = item?.slug || item?.profile_slug;
  const rawId = item?.id ?? item?.user_id ?? item?.profile_id;
  if (typeof slug === 'string' && slug.trim()) return `/profile/${slug.trim()}`;
  if (typeof rawId === 'string' && rawId.trim()) return `/profile/${rawId.trim()}`;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return `/profile/${rawId}`;
  return '/profile';
}