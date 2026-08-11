import { NextRequest, NextResponse } from "next/server";

export type Portal = "MEMBER" | "SUPER_ADMIN" | "ADMIN";

// The back-office portal is enabled by default. Set NEXT_PUBLIC_ENABLE_ADMIN_PORTAL
// to a falsey value ("false"/"0") to intentionally pause /admin and /super-admin.
// Case-insensitive so "True"/"TRUE"/"true" all behave identically.
const ADMIN_PORTAL_ENABLED =
  String(process.env.NEXT_PUBLIC_ENABLE_ADMIN_PORTAL ?? "true").toLowerCase() !== "false";
const authRoutes = new Set(["/login", "/register", "/verify-otp", "/forgot-password", "/reset-password", "/admin/login", "/super-admin/login"]);

export function routePolicy(pathname: string): { roles: Portal[]; login: string } | null {
  if (authRoutes.has(pathname)) return null;
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) return { roles: ["SUPER_ADMIN"], login: "/super-admin/login" };
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return { roles: ["SUPER_ADMIN", "ADMIN"], login: "/admin/login" };
  if (pathname.startsWith("/membership/")) return { roles: ["MEMBER"], login: "/login" };
  const memberRoots = ["/dashboard", "/profile", "/search", "/matches", "/interests", "/shortlist", "/messages", "/tickets", "/support", "/notifications", "/settings", "/compare"];
  return memberRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))
    ? { roles: ["MEMBER"], login: "/login" }
    : null;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pausedBackOffice = ["/admin", "/super-admin"]
    .some((root) => pathname === root || pathname.startsWith(`${root}/`));
  if (!ADMIN_PORTAL_ENABLED && pausedBackOffice) return NextResponse.redirect(new URL("/", request.url));
  const policy = routePolicy(pathname);
  if (!policy) return NextResponse.next();
  const portal = request.cookies.get("mdp_portal")?.value as Portal | undefined;
  if (!portal) {
    const loginUrl = new URL(policy.login, request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return policy.roles.includes(portal) ? NextResponse.next() : NextResponse.redirect(new URL("/403", request.url));
}

// Next's development client communicates over `/_next/webpack-hmr`.  Routing
// any `/_next` request through this proxy turns that WebSocket upgrade into an
// ordinary HTTP response, preventing client-side hydration and leaving every
// React button inert.  Internal Next routes must bypass application middleware.
export const config = { matcher: ["/((?!api|_next(?:/|$)|favicon.ico|images|fonts).*)"] };
