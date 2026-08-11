'use client';

import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

type To = string | { pathname?: string; search?: string; hash?: string };
type NavigateOptions = { replace?: boolean; state?: unknown; preventScrollReset?: boolean };
type SearchParamsInit = URLSearchParams | Record<string, string>;
type SearchParamsSetter = (
  next: SearchParamsInit | ((previous: URLSearchParams) => SearchParamsInit),
  options?: NavigateOptions,
) => void;

function toHref(to: To) {
  if (typeof to === 'string') return to;
  return `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}` || '/';
}

function stateKey(href: string) {
  return `mdp.router.state:${href.split('#')[0]}`;
}

function rememberState(href: string, state: unknown) {
  if (typeof window === 'undefined' || state === undefined) return;
  try {
    window.sessionStorage.setItem(stateKey(href), JSON.stringify(state));
  } catch {
    // Navigation must still work when storage is unavailable.
  }
}

function fallbackFor(pathname: string) {
  if (pathname.startsWith('/super-admin')) return '/super-admin/dashboard';
  if (pathname.startsWith('/admin')) return '/admin/dashboard';
  if (pathname.startsWith('/staff')) return '/staff/dashboard';
  if (pathname.startsWith('/support')) return '/support/dashboard';
  return '/dashboard';
}

export type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
  & Omit<NextLinkProps, 'href'>
  & { to: To; state?: unknown };

export function Link({ to, state, onClick, children, ...props }: LinkProps) {
  const href = toHref(to);
  return <NextLink
    href={href}
    {...props}
    onClick={(event) => {
      rememberState(href, state);
      onClick?.(event);
    }}
  >{children}</NextLink>;
}

export function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback((to: To | number, options: NavigateOptions = {}) => {
    if (typeof to === 'number') {
      if (to < 0 && typeof window !== 'undefined' && window.history.length > 1) router.back();
      else router.push(fallbackFor(pathname));
      return;
    }
    const href = toHref(to);
    rememberState(href, options.state);
    if (options.replace) router.replace(href, { scroll: !options.preventScrollReset });
    else router.push(href, { scroll: !options.preventScrollReset });
  }, [pathname, router]);
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  const search = searchParams.toString();
  const href = `${pathname}${search ? `?${search}` : ''}`;
  const [state, setState] = useState<unknown>(null);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(stateKey(href));
      setState(raw ? JSON.parse(raw) : null);
    } catch {
      setState(null);
    }
  }, [href]);
  return useMemo(() => ({ pathname, search: search ? `?${search}` : '', hash: '', state, key: href }), [href, pathname, search, state]);
}

export function useSearchParams(): [URLSearchParams, SearchParamsSetter] {
  const current = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const params = useMemo(() => {
    const mutable = new URLSearchParams(current.toString());
    if (pathname.startsWith('/messages/') && !mutable.has('user')) {
      mutable.set('user', decodeURIComponent(pathname.slice('/messages/'.length).split('/')[0]));
    }
    return mutable;
  }, [current, pathname]);
  const setParams = useCallback<SearchParamsSetter>((next, options = {}) => {
    const resolved = typeof next === 'function'
      ? next(new URLSearchParams(params))
      : next;
    const query = resolved instanceof URLSearchParams ? resolved : new URLSearchParams(resolved);
    const href = `${pathname}${query.toString() ? `?${query}` : ''}`;
    if (options.replace) router.replace(href, { scroll: !options.preventScrollReset });
    else router.push(href, { scroll: !options.preventScrollReset });
  }, [params, pathname, router]);
  return [params, setParams];
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  return useNextParams() as T;
}

export function useMatch(pattern: string) {
  const pathname = usePathname();
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index].startsWith(':')) params[expected[index].slice(1)] = actual[index];
    else if (expected[index] !== actual[index]) return null;
  }
  return { params, pathname, pathnameBase: pathname, pattern };
}

export function Navigate({ to, replace = false, state }: { to: To; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  const href = toHref(to);
  useEffect(() => navigate(href, { replace, state }), [href, navigate, replace, state]);
  return null;
}

export function Outlet({ children = null }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function BrowserRouter({ children }: { children: ReactNode }) { return <>{children}</>; }
export const MemoryRouter = BrowserRouter;
export function Routes({ children }: { children: ReactNode }) { return <>{children}</>; }
export function Route({ element = null }: { element?: ReactNode; [key: string]: unknown }) { return <>{element}</>; }
