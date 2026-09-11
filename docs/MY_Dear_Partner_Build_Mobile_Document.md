# My Dear Partner — Full Application & Mobile Build Document

**Generated scan date:** 2026-08-21
**Targets:** Full web app + iOS + Android (Capacitor 8.5.0)
**Stack:** Next.js 16.2.9 (App Router) + React 19 + Django/DRF backend + PostgreSQL + Redis

---

## 1. Application Overview

My Dear Partner is a premium matchmaking platform built as a **modular monolith**:

- **Frontend** — `frontend/` — Next.js 16.2.9 App Router, React 19.2, TypeScript 5.9, Tailwind v4 (CSS-config), Framer Motion, Redux Toolkit, lucide-react, Capacitor for mobile.
- **Backend** — `backend/` — Django 5.0 + DRF, PostgreSQL (via pgbouncer), Redis, Celery + Celery Beat, Channels/Daphne for WebSocket chat.
- **Infra** — `docker-compose.yml` — postgres, pgbouncer, redis, backend, celery-worker, celery-beat, migrate, nextjs, nginx. Reverse proxy gateways at ports 80/443.

---

## 2. Environment Variables (frontend/.env.example)

```bash
NODE_ENV=production
INTERNAL_API_BASE_URL=http://backend:8000/api/v1   # server-side proxy target
AUTH_COOKIE_SECURE=true
NEXT_PUBLIC_APP_NAME=My Dear Partner
NEXT_PUBLIC_APP_URL=https://mydearpartner.com
NEXT_PUBLIC_API_BASE_URL=/api/v1                    # SPA base for REST
NEXT_PUBLIC_WS_BASE_URL=wss://mydearpartner.com     # WebSocket for chat
NEXT_PUBLIC_MEDIA_BASE_URL=https://mydearpartner.com/media
NEXT_PUBLIC_ENABLE_ADMIN_PORTAL=true
```

> **Mobile note:** For the Capacitor shell these same `NEXT_PUBLIC_*` values are used; the native app points at the deployed HTTPS host via `CAPACITOR_SERVER_URL`.

---

## 3. Complete Route Map (App Router)

### 3a. Public / Guest routes

| URL | Page | Layout |
|---|---|---|
| `/` | Home / Landing | `(public)/layout.tsx` |
| `/about` | About | `(public)` |
| `/contact` | Contact | `(public)` |
| `/faq` | FAQ | `(public)` |
| `/help` | Help Centre | `(public)` |
| `/privacy` | Privacy Policy | `(public)` |
| `/refund-policy` | Refund Policy | `(public)` |
| `/success-stories` | Success Stories | `(public)` |
| `/terms` | Terms of Service | `(public)` |
| `/membership` | Membership Plans | public shell |
| `/members` | Members listing | public shell |

### 3b. Auth routes (`(auth)`)

| URL | Page |
|---|---|
| `/login` | Login (guest only) |
| `/register` | Register (guest only) |
| `/forgot-password` | Forgot password (guest only) |
| `/reset-password` | Reset password (guest only) |
| `/verify-otp` | OTP verification (guest only) |
| `/403` | Access denied |
| `/session-expired` | Session expired |

### 3c. Admin auth

| URL | Page |
|---|---|
| `/admin/login` | Admin login `(admin-auth)` |
| `/staff/login` | Staff login `(admin-auth)` |
| `/super-admin/login` | Super Admin login `(admin-auth)` |

### 3d. Member routes (`(member)`, auth-protected)

**Core:**
- `/dashboard` – Discover feed (premium card stack)
- `/search` – Profile search
- `/matches` – Matches
- `/compare` – Compare
- `/shortlist` – Shortlist
- `/blocked` – Blocked & Rejected
- `/visitors` – Profile visitors
- `/messages` – Message list
- `/messages/[conversationId]` – Chat thread (WebSocket)
- `/interests` – Interests hub
- `/interests/sent` – Sent
- `/interests/received` – Received
- `/interests/accepted` – Accepted
- `/interests/declined` – Declined
- `/notifications` – Notifications
- `/support` – Support
- `/support/[id]` – Support detail
- `/tickets` – Support tickets
- `/tickets/[id]` – Ticket detail
- `/verification` – Verification center

**Profile:**
- `/profile` (`(member)/profile/page.tsx`)
- `/profile/me` – My profile
- `/profile/[id]` – Public profile detail
- `/profile/edit` – Edit profile (single page)
- `/profile/photos` – Photo manager
- `/profile/documents` – Documents

**Settings:**
- `/settings` – Settings hub
- `/settings/security`
- `/settings/notifications`
- `/settings/privacy`
- `/settings/membership`
- `/settings/profile`
- `/settings/profile/career`
- `/settings/profile/family`
- `/settings/profile/personal`
- `/settings/profile/preferences`

### 3e. Admin / Super-Admin / Staff portals

- `(admin-portal)/admin/[...slug]` — Admin app (dynamic)
- `(admin-portal)/super-admin/[...slug]` — Super Admin app
- `(staff-portal)/staff/[...slug]` — Staff app
- Non-dynamic index pages for each portal

**Admin routes (config/routes.ts → adminRoutes):** `/admin/dashboard`, `/admin/members`, `/admin/profiles`, `/admin/photos`, `/admin/documents`, `/admin/memberships`, `/admin/memberships/payments`, `/admin/memberships/refunds`, `/admin/tickets`, `/admin/contact-enquiries`, `/admin/complaints`, `/admin/reported-profiles`, `/admin/reports`, `/admin/audit-logs`, `/admin/settings`, `/admin/backups`.

**Super Admin:** same set under `/super-admin/...` plus `/super-admin/admin-accounts`.



## 6. iOS & Android Build (Capacitor)

Capacitor 8.5.0 is already installed (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`).

### 6a. Capacitor config (`frontend/capacitor.config.ts`)

```ts
const mobileServerUrl = process.env.CAPACITOR_SERVER_URL || 'http://192.168.1.29:3000';
const config: CapacitorConfig = {
  appId: 'com.mydearpartner.app',
  appName: 'My Dear Partner',
  webDir: 'mobile-web',                 // tiny fallback bundle
  server: { url: mobileServerUrl, cleartext: mobileServerUrl.startsWith('http://') },
};
```

**Critical:** `webDir` is `mobile-web`. The app is **server-rendered**, so the native shell loads the **deployed website** through `server.url` (the live HTTPS address for release, or a LAN address for development). You do **not** package `.next` into the app binary.

### 6b. Prerequisites

| Tool | Needed for | Version |
|---|---|---|
| Node.js + npm | build Next, run Cap CLI | ≥ 18 |
| **Android Studio** | Android SDK/emulator, Gradle | latest stable |
| **Xcode** (macOS only) | iOS build + signing | latest stable |
| CocoaPods | iOS Capacitor pods | latest |
| Java JDK 17 | Android Gradle | 17 |

> iOS builds **require a Mac with Xcode**. Android can build on Windows/Linux/macOS.

### 6c. Build & export steps

```bash
cd frontend

# 1) Install deps
npm ci

# 2) Build the Next.js production bundle
npm run build            # must succeed (Compiled successfully)

# 3) Prepare the mobile fallback webDir
mkdir -p mobile-web
echo "..." > mobile-web/index.html   # minimal loader redirecting to the server URL

# 4) Create/refresh the native projects
npx cap add android
npx cap add ios

# 5) Copy web assets + plugins into the native project
npx cap sync

# 6) Point at your live HTTPS host for release
$env:CAPACITOR_SERVER_URL="https://mydearpartner.com"   # PowerShell

## 7. Docker Deploy (current running environment)

```bash
# Full rebuild + up
docker compose up -d --build postgres pgbouncer redis backend celery-worker celery-beat nextjs nginx

# Status
docker compose ps              # all healthy

# Access
https://localhost              # local
https://192.168.0.64           # LAN (for testing on another device)
```

**Services:** nginx (80/443), nextjs (3000, internal), backend (8000, internal), postgres/pgbouncer/redis, celery-worker, celery-beat, migrate (one-shot).

---

## 8. Verification Checklist

- [ ] `npm run typecheck` / Docker `npm run build` — Compiles with no errors
- [ ] `docker compose ps` — all services healthy
- [ ] Public route reachable (`/`, `/about`, `/membership`)
- [ ] Login works; member dashboard loads `/dashboard`
- [ ] Profile edit `/profile/edit` loads (verification steps link here)
- [ ] Swipe animation on Discover `/dashboard` plays
- [ ] Mobile drawer opens/closes (laptop ≥1024px shows desktop sidebar)
- [ ] Android: `assembleDebug` produces APK
- [ ] iOS: Xcode archive succeeds (macOS only)

---

## 9. Notes & Limitations

- **`webDir: mobile-web`** is only a lightweight loader — the real app is server-driven. For an **offline/full-PWA** experience you would switch to `output: "export"`/static export and bundle `.next` in the app, which is **not** currently set up.
- iOS signing and a paid Apple Developer account are required to ship via the App Store.
- Razorpay checkout and Firebase are configured in the stack; native push (FCM) would need additional `@capacitor/push-notifications` wiring (not currently installed).

export CAPACITOR_SERVER_URL="https://mydearpartner.com" # bash/mac
npx cap sync
```

### 6d. Android — build APK/AAB

```bash
cd android
# debug APK
./gradlew assembleDebug          # → android/app/build/outputs/apk/debug/app-debug.apk
# release AAB (Play Store)
./gradlew bundleRelease          # → android/app/build/outputs/bundle/release/app-release.aab
# open in Android Studio
npx cap open android
```

- Sign release with a keystore (Android Studio → Build → Generate Signed Bundle).

### 6e. iOS — build IPA

```bash
npx cap sync ios
npx cap open ios            # opens Xcode workspace: ios/App/App.xcworkspace
```

In Xcode:
1. Select a Team under **Signing & Capabilities** (Apple Developer account).
2. Set a **Bundle Identifier** (default `com.mydearpartner.app`).
3. Simulator: **Product → Run**. Device: select device + **Product → Archive** → Distribute App.

### 6f. Required Info.plist / Manifest

- **iOS** (`ios/App/App/Info.plist`): `NSAppTransportSecurity` exception if using HTTP (dev only; HTTPS needs none). Add camera/photo usage strings if enabled.
- **Android** (`android/app/src/main/AndroidManifest.xml`): `android:usesCleartextTraffic="true"` only for dev HTTP; `INTERNET` permission is added by Capacitor by default.

---

## 4. Layouts & Providers

| Layout | Purpose |
|---|---|
| `app/layout.tsx` | Root (fonts, globals, metadata) |
| `(auth)/layout.tsx` | Auth pages shell |
| `(member)/layout.tsx` | Member sidebar + mobile bottom nav + realtime wrapper + memberships provider |
| `(member)/profile/layout.tsx` | Profile section header nav |
| `(member)/settings/layout.tsx` | Settings tabs shell |
| `(public)/layout.tsx` | Public header/footer shell |
| `(admin-portal)/*/layout.tsx` | Admin / Super-Admin shells |
| `(staff-portal)/staff/layout.tsx` | Staff shell |
| `payment/status/layout.tsx` | Payment status shell |
| `settings/layout.tsx` | Legacy settings shell |

**Global CSS:** `app/globals.css` — Tailwind v4 `@theme` + custom member shell / sidebar / drawer / discover / messages / WhatsApp-style styles.

---

## 5. Authentication & API

- **Login** `POST /auth/login` (Django via proxy). Sets HttpOnly `access_token` + `refresh_token` cookies. Auth flow logs in members, admins, super-admins, staff on separate namespaces.
- **Proxy** `frontend/app/api/proxy/[...path]` → Django. Handles bearer injection, cookie refresh, protected photo/document/attachment paths, and `PHOTO_ACCESS_COOKIE`.
- **WebSocket** chat via `wss`; subprotocol carries the access token; authenticated HTTP fallback when disconnected.

---

### 3f. API / payment / misc routes

- `/api/proxy/[...path]` – Next Route Handler → Django proxy (auth + photo/webhook forwarding)
- `/api/auth/session`, `/api/ai/compatibility`
- `/payment/status/[orderId]` – Payment status
- `/settings/payments` – Payment history (legacy shell)

**Next redirects (next.config.ts):** `/membership-plans→/membership`, `/about-us→/about`, `/contact-us→/contact`, `/search-profiles→/search`, `/matchmaking→/matches`, `/admin-login→/admin/login`, `/unauthorized→/403`, `/admin/users→/admin/members`, several `/admin/*` canonical redirects.

---

