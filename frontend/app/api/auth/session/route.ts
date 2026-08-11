import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import {
  accountNamespaces,
  PORTAL_COOKIE,
  PHOTO_ACCESS_COOKIE,
  REFRESH_COOKIE,
  type AccountType,
} from "@/lib/auth-config";

export const dynamic = "force-dynamic";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: serverEnv.authCookieSecure,
    sameSite: "lax" as const,
    path: "/",
  };
}

function isAccountType(value: string | undefined): value is AccountType {
  return Boolean(value && value in accountNamespaces);
}

function tokenData(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as Record<string, unknown>;
  return envelope.data && typeof envelope.data === "object"
    ? envelope.data as Record<string, unknown>
    : envelope;
}

export async function GET(request: NextRequest) {
  const accountType = request.cookies.get(PORTAL_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!isAccountType(accountType) || !refresh) {
    return NextResponse.json(
      { account_type: null, authenticated: false },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  }

  try {
    const baseUrl = serverEnv.INTERNAL_API_BASE_URL.replace(/\/$/, "");
    const upstream = await fetch(`${baseUrl}/${accountNamespaces[accountType]}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    const data = tokenData(await upstream.json().catch(() => null));
    const access = data && typeof data.access === "string" ? data.access : null;
    if (!upstream.ok || !access) throw new Error("Session refresh failed.");

    const response = NextResponse.json(
      { account_type: accountType, authenticated: true, access },
      { headers: { "Cache-Control": "no-store, private" } },
    );
    const refreshedToken = data && typeof data.refresh === "string" ? data.refresh : null;
    if (refreshedToken) response.cookies.set(REFRESH_COOKIE, refreshedToken, cookieOptions());
    response.cookies.set(PORTAL_COOKIE, accountType, cookieOptions());
    response.cookies.set(PHOTO_ACCESS_COOKIE, access, cookieOptions());
    return response;
  } catch {
    const response = NextResponse.json(
      { account_type: null, authenticated: false },
      { headers: { "Cache-Control": "no-store, private" } },
    );
    for (const name of [REFRESH_COOKIE, PORTAL_COOKIE, PHOTO_ACCESS_COOKIE]) {
      response.cookies.set(name, "", { ...cookieOptions(), maxAge: 0 });
    }
    return response;
  }
}
