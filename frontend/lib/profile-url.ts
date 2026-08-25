/**
 * Build a public, user-friendly profile URL from any profile-like object.
 *
 * Prefers the unique `profile_slug` and falls back to the internal id so
 * existing callers never break even if a payload predates slugs.
 */
export function profileHref(payload: unknown): string {
  const item = (payload ?? {}) as Record<string, any>;
  const slug = item?.slug || item?.profile_slug;
  const id = item?.id || item?.user_id || item?.profile_id;
  if (typeof slug === 'string' && slug.trim()) return `/profile/${slug.trim()}`;
  if (typeof id === 'string' && id.trim()) return `/profile/${id.trim()}`;
  return '/profile';
}