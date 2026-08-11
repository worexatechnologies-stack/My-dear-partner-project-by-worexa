# My Dear Partner Engineering Reference (Brain)

Last Updated & Audited: 2026-07-25

---

## 1. Project Overview & Technology Stack

My Dear Partner is a premium matchmaking web application built as a modular monolith. The migration target is a Next.js App Router web application backed by the existing Django REST Framework and Channels services. The original Vite client remains in the repository as a temporary parity and rollback reference.

### Frontend Stack
- **Framework**: Next.js v16.2.9 App Router with React v19.2.0
- **Language**: TypeScript v5.9.3
- **Routing**: Filesystem routes, nested route-group layouts, request-boundary route policy, and client session/permission guards
- **Styling**: Existing component CSS plus Tailwind CSS v4.3.2 through PostCSS
- **Typography and Images**: Locally bundled DM Sans/Manrope fonts and `next/image` with constrained remote origins
- **Animations**: Framer Motion v12.35.0 with lazy feature loading
- **HTTP Client**: Same-origin Next Route Handler proxy to Django; in-memory access JWT and HttpOnly rotating refresh cookie
- **State Management**: Per-browser Redux Toolkit store, RTK Query, AuthContext, and ThemeContext
- **Testing**: Vitest + jsdom and Playwright scripts
- **Migration Reference**: `frontend/` retains the Vite v7/React Router application until release parity is approved

### Backend Stack
- **Core Language**: Python v3.13
- **Web Framework**: Django v5.0.14
- **API Framework**: Django REST Framework (DRF) v3.15
- **Database**: PostgreSQL (via `psycopg2-binary` or `pg8000`)
- **Authentication**: JWT via `djangorestframework-simplejwt` v5.3.1
- **Asynchronous Task Queue**: Celery v5.5
- **Task Scheduler**: Celery Beat v2.4 + `django-celery-beat`
- **In-Memory Cache / Broker**: Redis v5.0
- **Storage**: Private media file storage utilizing short-lived presigned URLs.
- **Testing**: pytest v9.1.1 + `pytest-django`

### Infrastructure Stack
- **Web Server**: Nginx routes pages to Next.js, REST/WebSockets to Django/Daphne, and public static/media paths to mounted volumes
- **Web Frontend Runtime**: Next.js standalone server on port 3000, running as a non-root container user
- **ASGI Server**: Daphne on port 8000 for Django HTTP and Channels/WebSocket compatibility
- **Containerization**: Docker & Docker Compose

---

## 2. Directory Layout & Folder Structure

The migration adds the following authoritative top-level boundaries. The more detailed legacy tree below is retained for domain-file orientation, but `frontend/` is no longer the cutover target.

```text
my-dear-partner/
|-- backend/                 # Django REST, Channels, Celery, models, and migrations
|-- frontend-next/           # Next.js App Router migration target
|   |-- app/                 # Route groups, layouts, metadata, and BFF handlers
|   |-- components/          # Next-aware guards, layouts, and shared UI
|   |-- legacy/              # Migrated interaction-heavy UI and service modules
|   |-- public/              # Used, reviewed public assets only
|   `-- Dockerfile           # Standalone non-root Next runtime image
|-- frontend/                # Original Vite client; temporary parity/rollback reference
|-- docs/                    # Architecture, audit checklist, and migration report
|-- docker-compose.yml       # Full service topology
|-- architecture.mmd         # Renderable current runtime diagram
`-- brain.md                 # Engineering/domain reference
```

```text
my-dear-partner/
├── .agents/                      # Custom developer skills and agents
├── backend/                      # Django REST API application root
│   ├── config/                   # Settings, URL patterns, ASGI/WSGI, Celery config
│   │   ├── settings/             # Base, Development, Test, and Production Django settings
│   │   ├── asgi.py               # Channels and ASGI hook
│   │   ├── celery.py             # Celery framework initialization
│   │   ├── urls.py               # Root API and admin URL pattern mapping
│   │   └── wsgi.py               # WSGI fallback hook
│   ├── apps/                     # Django apps partition
│   │   ├── accounts/             # Authentication, user roles, OTP challenge, location schema
│   │   │   ├── management/       # Commands like 'create_super_admin', 'create_staff'
│   │   │   ├── models.py         # Member, Admin, Staff, Support Agent, Locations, AccessScopes
│   │   │   ├── views.py          # Auth, verification document views
│   │   │   └── urls.py           # Subsystem endpoint router
│   │   └── core/                 # Matchmaking, chats, payments, tickets, verification workflows
│   │       ├── models.py         # Subscriptions, tickets, payments, logs, etc.
│   │       ├── views.py          # Member-facing profile list, details, chats, compatibility
│   │       ├── role_views.py     # Administrative actions, ticket assignments, settings
│   │       ├── entitlements.py   # Membership plan limits and rights checker
│   │       └── serializers.py    # Request/Response format adapters
│   ├── manage.py                 # Django command-line executor
│   ├── requirements/             # Python PIP dependency lists
│   └── Dockerfile                # Production multi-stage python build
├── frontend/                     # React web single page application
│   ├── src/                      # Source files root
│   │   ├── assets/               # CSS styles, images, global icons
│   │   ├── components/           # Reusable generic UI controls, navbar, layouts
│   │   ├── contexts/             # AuthContext, ThemeContext providers
│   │   ├── data/                 # Static config selections
│   │   ├── pages/                # Public and Member application routes
│   │   │   └── admin/            # Administrative portals (Super Admin, Admin, CS Agent, Staff)
│   │   ├── services/             # HTTP client (apiClient), typed backend service wrappers
│   │   ├── types/                # TypeScript interface mappings
│   │   ├── App.tsx               # Main application routing and route guards
│   │   └── main.tsx              # React client mount root
│   ├── package.json              # NPM dependency and scripts configuration
│   └── vite.config.ts            # Vite compile environment properties
├── docker-compose.yml            # System services orchestration script
└── brain.md                      # Principal system engineering reference index (This file)
```

---

## 3. Local Setup & Getting Started

### Backend Getting Started
1. **Requirements**: Ensure Python 3.13+ is installed on your machine.
2. **Setting Up Virtual Environment & Dependencies**:
   ```powershell
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements/base.txt -r requirements/development.txt
   ```
3. **Database Migrations**:
   ```powershell
   python manage.py makemigrations accounts core
   python manage.py migrate
   ```
4. **Create Super Admin**:
   ```powershell
   python manage.py create_super_admin
   ```
   *Creates the initial super admin account for the administration portal.*
5. **Starting the Dev Server**:
   ```powershell
   python manage.py runserver
   ```
   *The API will start at `http://localhost:8000/`.*

### Next.js Frontend Getting Started
1. **Installing Dependencies**:
   ```powershell
   cd frontend-next
   Copy-Item .env.example .env.local
   npm ci
   ```
2. **Running the Development Server**:
   ```powershell
   npm run dev
   ```
   *The application runs at `http://localhost:3000`. The local defaults proxy Django API requests to `http://localhost:8000/api/v1` and connect chat to `ws://localhost:8000`.*
3. **Testing, Linting, & Bundling**:
   ```powershell
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npm run test:e2e
   ```

The original Vite client can still be started from `frontend/` for parity comparisons, but it is not the migration target and must not be deleted until cutover acceptance is complete.

### Celery, Redis, & Background Tasks
Start the Redis broker locally, then execute:
```powershell
# In backend directory with active virtual environment
celery -A config worker --loglevel=info
celery -A config beat --loglevel=info
```

### Performance Auditing (k6)
Ensure `k6` is installed on your local computer, then run:
```powershell
k6 run performance-tests/k6_load_test.js
```
The load tests assert:
- `http_req_duration`: 95th percentile response latency `< 500ms`
- `http_req_failed`: Success request rates `> 99%`

---

## 4. Domain Models & Database Schema

### Database Conventions
- **Explicit Naming**: Table names are explicitly declared as pluralized snake_case.
- **UUID Keys**: All models utilize UUID primary keys for secure resource endpoints.
- **Timestamps**: Models include timezone-aware `created_at` and `updated_at` timestamps.

### Accounts Domain Models
1. **Member (`members`)**: Represents seekers. Contains personal metadata, `profile_status` (DRAFT, PENDING, APPROVED, REJECTED, SUSPENDED), `photo_status`, and `document_status`.
2. **Department (`departments`)** & **Designation (`designations`)**: Administrative structures.
3. **AdminRole (`admin_roles`)** & **AdminPermission (`admin_permissions`)**: Core RBAC permission nodes. Mapped via junction model `AdminRolePermission` (`admin_role_permissions`).
4. **SuperAdmin (`super_admins`)**: Core system owners.
5. **Admin (`admins`)**: Intermediate operations managers. Linked to designation, department, and geographic locations.
6. **Staff (`staff`)**: Moderation and verification handlers. Associated with manager admins.
  7. **Support Tickets** routed only to Admin/SuperAdmin (CustomerSupportAgent role removed).
  8. **Locations Hierarchy**:
     - `Country` (`countries`): Stores code and name.
     - `State` (`states`): Linked to Country.
     - `City` (`cities`): Linked to State.
     - `Branch` (`branches`): Linked to City.
  9. **Access Scopes**:
     - `AdminAccessScope` (`admin_access_scopes`)
     - `StaffAccessScope` (`staff_access_scopes`)
     - (CustomerSupportAccessScope removed)
     - Contains FKs pointing to `Country`, `State`, `City`, `Branch`, `Department` along with flags `can_view`, `can_create`, `can_edit`, `can_assign`, `can_approve`, `can_escalate`.

### Core Business Domain Models
1. **MemberProfile (`member_profiles`)**: Detailed seeker demographics, marital status, physical properties, caste, annual income, work location, family attributes.
2. **MemberPreference (`member_preferences`)**: Age, height, religion, location partner match preferences.
3. **MemberPhoto (`member_photos`)**: Multiple user photos. One primary photo allowed.
4. **MemberDocument (`member_documents`)**: KYC documents in secure private media storage.
5. **DuplicateAccountFlag (`duplicate_account_flags`)**: Maps suspected duplicate profiles identified via exact matching email, mobile number, photo hashing, or device fingerprints.
6. **MembershipPlan (`membership_plans`)**: Subscription catalog (Free, Gold, Platinum, Elite).
7. **MemberMembership (`member_memberships`)**: Current plan active durations.
8. **Interest (`interests`)**: Connection invitations. Constrained by unique sender-receiver couples and self-matching preventions.
9. **ChatMessage (`chat_messages`)**: Messaging history.
10. **Payment (`payments`)**: Triggers Razorpay payment order states (PENDING, SUCCESS, FAILED, REFUNDED).
11. **RefundRequest (`refund_requests`)**: Logs refund reviews and statuses.
12. **SupportTicket (`support_tickets`)**: Member issue tickets. Assigned to Admin or SuperAdmin (CustomerSupportAgent removed).
13. **ProfileVerificationRequest (`profile_verification_requests`)**: Queue of KYC validation requests.
14. **WorkAssignment (`work_assignments`)**: Administrative moderation allocations (verification, complaints).
15. **AuthSession (`account_sessions`)**: Stores token credentials versions.
16. **AuthChallenge (`auth_challenges`)**: SMS/OTP mobile registration challenges.

---

## 5. Authentication & Security Policies

### Authentication & Login URLs
Stateless JSON Web Tokens (JWT) are verified via `simplejwt`:
- **Member**: `/api/v1/member-auth/login/`
- **Super Admin**: `/api/v1/super-admin-auth/login/`
- **Admin**: `/api/v1/admin-auth/login/`
- **Staff**: `/api/v1/staff-auth/login/`
- **Customer Support**: (removed — tickets handled by Admin/SuperAdmin)

### Portal Mismatch Checks
To prevent privilege escalation, administrative login flows verify credentials and match the account type to the specific endpoint. If a user supplies correct credentials but hits the wrong endpoint, the API rejects the request:
- **HTTP Code**: 400 Bad Request
- **JSON Error**: `ACCOUNT_PORTAL_MISMATCH`
- **Metadata**: Returns the correct target portal redirect path.
Failed login attempts lockout the administrative accounts for 15 minutes after 5 consecutive failures.

### Token Isolation
The Next client calls Django through `/api/proxy/*`. A rotating refresh JWT is stored as the `mdp_refresh` HttpOnly, SameSite cookie (Secure in production), while the access JWT exists only in browser module memory. Login/refresh responses are stripped of refresh credentials before reaching JavaScript. Refresh attempts are serialized, stale requests are aborted, and RTK Query private state is reset whenever the session changes. Legacy access/refresh values are proactively removed from browser storage.

The `mdp_portal` cookie is a coarse route hint, not authorization. All protected Django endpoints validate the authenticated account type, active state, permissions, entitlements, geographic scope, and target object as appropriate. The request-boundary and client guards exist for safe navigation and do not replace backend enforcement.

Every auth namespace exposes local logout and logout-all-devices operations. Logout-all invalidates all recorded sessions for the account; the BFF removes its refresh/portal cookies after either logout flow.

### WebSocket Authentication

Chat obtains a fresh in-memory access token and sends it through the WebSocket subprotocol pair `['access_token', token]`; it is not placed in the browser-visible socket URL. Channels uses allowed-host origin validation and checks chat entitlement and partner/account eligibility on both connection and send. The client maintains one active-partner socket, cleans it up on navigation, retries with bounded backoff, and uses authenticated HTTP delivery when the socket is unavailable.

### Administrative Audit Trail
Destructive or sensitive administrative actions (verifications, status changes, suspensions, refund approvals) automatically emit an audit log entry in `AdminActivityLog`.

---

## 6. Administrative Workflows, Access Scopes, & RBAC Matrix

### Profile Verification Workflow State Machine
```text
[*] --> DRAFT : Onboarding Registration
DRAFT --> PENDING : Member Profile Submit
PENDING --> ASSIGNED : Admin Allocates to Staff (AdminAssignWorkView)
ASSIGNED --> IN_REVIEW : Staff Starts Review (StaffWorkActionView)
IN_REVIEW --> APPROVED : Staff Approves Profile (Visible in matching pools)
IN_REVIEW --> REJECTED : Staff Rejects Profile (Notes required, profile editable)
IN_REVIEW --> ESCALATED : Staff Escalates to Admin (Admin reviews & resolves)
```

### Access Scopes Queryset Filtering
Backend querysets filter data dynamically based on the request user's active geographic access scopes:
1. **Super Admin**: Bypasses all geographic checks (global scope access).
2. **Admin, Staff**: Filter query results (members, verifications, tickets) by allowed branches. (CustomerSupport role removed)
3. **Primary Branch Fallback**: If no specific scopes are declared in `AccessScope` tables, the system falls back to the account's primary `branch_id`.
4. **IDOR Prevention**: Detail views check object scope ownership via `check_object_scope()`. Querying an object belonging to a branch outside the user's active scope results in a `403 Forbidden` response.

### RBAC Portal Permissions Mapping

| Feature Module | API Endpoint Path | Super Admin | Admin | Staff | Customer Support | Member |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| Profile Settings | `/api/v1/member-auth/me/` | ✗ | ✗ | ✗ | ✗ | **Owner** |
| Pricing Plans | `/api/v1/admin/membership-plans/` | **CRUD** | **CRUD** | ✗ | ✗ | **Read** |
| Departments / design. | `/api/v1/super-admin/departments/`| **CRUD** | ✗ | ✗ | ✗ | ✗ |
| Database Backups | `/api/v1/admin/backups/` | **CRUD** | ✗ | ✗ | ✗ | ✗ |
| System Settings | `/api/v1/admin/settings/` | **CRUD** | ✗ | ✗ | ✗ | ✗ |
| Refund Approvals | `/api/v1/admin/refunds/` | **Approve** | **Approve** | ✗ | ✗ | ✗ |
| Match compatibility | `/api/v1/matchmaking/compatibility/` | ✗ | ✗ | ✗ | ✗ | **Active** |
| Ticket Assignment | `/api/v1/admin/assign-ticket/` | **Write** | **Write** | ✗ | ✗ | ✗ |
| Moderation Queue | `/api/v1/staff/verifications/` | ✗ | ✗ | **Assigned** | ✗ | ✗ |
| Support Operations | `/api/v1/admin/tickets/` | **CRUD** | **CRUD** | ✗ | ✗ | **Owner** |
| Duplicate Flags Audit | `/api/v1/admin/duplicate-flags/` | **CRUD** | **CRUD** | **CRUD** | ✗ | ✗ |

---

## 7. Performance & Code Quality Audits

### React Doctor Audit Findings
- **Reduced Motion Support**: framer-motion loops must be accompanied by `@media (prefers-reduced-motion: reduce)` to support WCAG 2.3.3 rules.
- **Layout Animations**: Avoid animating raw layout values (such as `width` or `height`) inside loops. Scale animations via `transform: scaleX()` to bypass expensive reflow operations.
- **Impure Operations**: Remove inline `Math.random()` loops inside render trees to avoid excessive component re-renders.

### Testing Setup Status
- **Pre-migration Frontend Baseline**: The retained Vite application recorded 4 files / 17 tests passing and a successful production build. Its 1.71 MB JavaScript output (447 KB gzip) triggered a bundle-size warning.
- **Next.js Release Gates**: TypeScript, ESLint, Vitest, production build, route smoke coverage, and browser E2E are separate gates for `frontend-next/`.
- **Backend Release Gates**: Django checks, migration-drift detection, pytest, and Ruff must run against the final migration tree.
- **Authoritative Results**: Current pass/fail evidence belongs in [`docs/nextjs-migration-report.md`](./docs/nextjs-migration-report.md). Do not infer that the Next migration passed from the Vite baseline.

---

## 8. Historical Gaps & Resolved Issues

- **TypeScript Compilation Mismatches**: Resolved strict compile type assertions inside `AdminAccountsPage.test.tsx` (casting mock roles to literals) and `RegisterPage.tsx` (omitting confirm_password key from matching DTOs).
- **Session Reset and Credential Exposure**: The Next client no longer restores JWTs from LocalStorage. It restores through the HttpOnly refresh cookie and Django verification, keeps access credentials in memory, and clears private request/cache state across auth transitions.
- **Settings Dashboard Config Tabs**: Expanded navigation layout in `AdminSystemPage.tsx` to support the 15 system tabs dynamically mapped to JSON settings keys.
- **Geographic Security Filtering**: Enforced queryset and object-level checks across members, verifications, and tickets, rendering access-denied fallbacks cleanly.
- **Final Super Admin Deletion Protection**: Restriced deletion operations on `SuperAdminAccountDetailView` and `AdminAccountDetailView` to prevent removing the final active platform owner account.
- **Razorpay Removal & Manual Activations**: Discarded online payment gateway checkouts in favor of a manual request queue (`MembershipRequest` model) under the configuration flag `PAYMENT_MODE = "manual_approval"`.
- **Matchmaking Seeker Filters**: Enforced strict opposite-gender queries inside `ProfileListView` (excluding admins, staff, and unapproved users) and enabled profile views for users without approved photos by implementing default silhouette avatar fallbacks.
- **Unique Limit Deduplication**: Adjusted daily limit calculations inside the serializer and profile view log to only increment counts for unique profile views today.
- **Document Verification Workspace**: Added a dedicated "Verification documents" portal inside `EditProfilePage.tsx` to upload proofs privately and monitor administrator reviews.
- **CustomerSupportAgent Removal**: Removed entire CustomerSupportAgent model, CustomerSupportAccessScope, CustomerSupportLoginActivity, CustomerSupportActivityLog, and 17 FK fields across core models. All support ticket assignment now uses Admin/SuperAdmin. Removed 13 backend views, 9 frontend pages, 5 service files, auth endpoints, and routes. Created migrations 0037/0038 (accounts) and 0040 (core).
- **Design System Modernization**: Replaced warm/earthy palette (plum #2b101d, rose #8e3d58, gold #d9b36c, cream #f7f1e8) with modern minimalist (slate #0f172a, blue #3b82f6, amber #f59e0b, white #ffffff). Updated Tailwind v4 @theme block, legacy CSS vars, 10+ component files, landing page gradients, and all hardcoded hex references.

---

## 9. Environment Configuration

### Environment Variables Matrix

| Key | Description | Type | Default Value | Required in Prod? |
| :--- | :--- | :---: | :--- | :---: |
| `DEBUG` | Controls Django debug mode. | Bool | `False` | No |
| `ENVIRONMENT` | Environment tier: `development`, `staging`, `production`. | String | `development` | Yes |
| `SECRET_KEY` | Strong Django session key. | String | `django-insecure-...` | **Yes** |
| `ALLOWED_HOSTS` | Comma-separated list of allowed domains. | List | `localhost,127.0.0.1` | **Yes** |
| `APP_NAME` | Display name of the platform. | String | `My Dear Partner` | No |
| `APP_URL` | Base application root path. | String | `http://localhost:8000` | Yes |
| `FRONTEND_URL` | Address of the React frontend SPA. | String | `http://localhost:5173` | Yes |
| `BACKEND_URL` | Address of the backend API server. | String | `http://localhost:8000` | Yes |
| `DB_ENGINE` | Django DB backend driver engine. | String | `django.db.backends.postgresql` | Yes |
| `DB_NAME` | Target database name. | String | `matiromony` | Yes |
| `DB_USER` | Connection username. | String | `postgres` | Yes |
| `DB_PASSWORD` | Connection credentials password. | String | `postgres` | **Yes** |
| `DB_HOST` | Database connection host address. | String | `localhost` | Yes |
| `DB_PORT` | Database port connection key. | Int | `5432` | Yes |
| `REDIS_URL` | Redis endpoint URL connection link. | String | `redis://localhost:6379/0` | Yes |
| `CELERY_BROKER_URL` | Celery broker queue URL. | String | `redis://localhost:6379/0` | Yes |
| `CELERY_RESULT_BACKEND` | Celery task result backend. | String | `redis://localhost:6379/0` | Yes |
| `JWT_ACCESS_TOKEN_MINUTES` | Lifetime of access tokens in minutes. | Int | `15` | No |
| `JWT_REFRESH_TOKEN_DAYS` | Lifetime of refresh tokens in days. | Int | `7` | No |
| `EMAIL_BACKEND` | Backend handler driver for emails. | String | `console` (dev) / `smtp` (prod) | Yes |
| `RAZORPAY_KEY_ID` | Razorpay Client Public Key. | String | `rzp_test_placeholder` | **Yes** |
| `RAZORPAY_KEY_SECRET` | Razorpay Client Private Secret Key. | String | `placeholder_secret` | **Yes** |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook authentication token. | String | `placeholder_webhook_secret` | **Yes** |
| `USE_S3` | Use AWS S3 for media storage. | Bool | `False` | No |
| `SECURE_SSL_REDIRECT` | Enable strict SSL redirect. | Bool | `False` | Yes (in Prod) |
| `SESSION_COOKIE_SECURE` | Set secure flag on session cookies. | Bool | `False` | Yes (in Prod) |
| `CSRF_COOKIE_SECURE` | Set secure flag on CSRF cookies. | Bool | `False` | Yes (in Prod) |

### Validation Engine
The central config manager [env_validator.py](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/backend/config/env_validator.py) checks and casts all raw strings to respective types on application startup. If any required keys are missing or default settings violate safety levels in `production` or `staging` mode (e.g. using default secret keys or empty DB passwords), it immediately halts the execution with a detailed trace log:
```text
DJANGO STARTUP CONFIGURATION ERROR:
The following required environment variables are missing or invalid:
- SECRET_KEY: Value is required but missing or set to default.
```

---

## 10. UI/UX Architecture & Premium Design System

The Member interface of **My Dear Partner** follows a modern, consumer-focused design system (similar to Airbnb and Stripe Dashboard) built with an 8px layout grid, clean typography (`DM Sans` + `Manrope`), and custom interactions.

### Design Tokens & Layout Constants

- **Typography Stack**:
  - Headings: `font-family: 'Manrope', sans-serif` (Heavy geometric weights: `700`, `800`)
  - Body: `font-family: 'DM Sans', sans-serif` (Sleek readability: `400`, `500`, `600`)
- **Modern Minimalist palette**: Slate neutrals (`#0f172a`, `#334155`), blue primary (`#3b82f6`), amber accent (`#f59e0b`), white surfaces (`#ffffff`). Replaced previous maroon/plum/rose/gold system.
- **Tailwind v4 @theme**: Design tokens defined in `frontend/app/globals.css` with `legacy/index.css` duplicating as `:root` CSS vars for legacy components.
- **Elevation / Shadows**: Clean, flat cards with low-intensity elevation shadows (`box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06)`).

### Refactored Interfaces

#### 1. Unified Navigation Header ([Navbar.tsx](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/frontend/src/components/Navbar.tsx))
- **Consolidated Actions**: Replaced redundant "Sign Out" and "Profile" links with a premium popup dropdown menu.
- **Search Shortcut**: Integrated a debounced search form directly in the header bar.
- **Real-time Badge Updates**: Periodically polls and displays unread notification counts on the Bell icon.

#### 2. Help Desk Portal ([SupportPage.tsx](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/frontend/src/pages/SupportPage.tsx))
- **Status Color Indicators**:
  - `Green` -> Resolved ticket resolution state.
  - `Yellow` -> Waiting for member response action.
  - `Blue` -> Assigned or In Progress support agent state.
  - `Red` -> Closed.
  - `Orange` -> Urgent / High priority SLA alert.
- **Split Workspace**: Left panel handles search, status, and priority query filters. Right panel houses bubble-chat timelines and resolution rating forms.
- **Rich Empty State Layouts**: If no ticket is selected, displays a dashboard showcasing SLA parameters, FAQ helpers, and a large ticket creation action.
- **Mobile Responsive Flow**: Dynamically splits layout into "Tickets List" and "Conversation" view tabs below 992px to prevent squeezed elements.

#### 3. Member Dashboard ([DashboardPage.tsx](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/frontend/src/pages/DashboardPage.tsx))
- **Profile Strength Checklist**: Integrates circular percentage counters with lists of missing fields.
- **Profile Visitor Insights**: Displays blurred, lock-badged visitors lists to standard members, prompting them to upgrade.

#### 4. Shimmer Skeleton Fallbacks ([SkeletonLoader.tsx](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/frontend/src/components/SkeletonLoader.tsx))
- Replaces generic spinner loading blocks with tailored shimmering layout cards for matches list, ticket conversations, dashboard graphs, and profile fields.

#### 5. Multi-Photo Gallery System ([EditProfilePage.tsx](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/frontend/src/pages/EditProfilePage.tsx))
- **6-Slot Gallery Grid**: Extends the member profile page with a premium 6-slot photos grid tab (modeled after Bumble and Airbnb layouts).
- **Primary vs. Gallery Assignment**: Allows seekers to select any approved photo in their gallery as primary. Automatically tags the first upload as primary.
- **Verification Triggering**: Spawns a photo verification request in the administrative queue (`ProfileVerificationRequest`) for each new upload, tracking individual approvals (`PENDING`, `APPROVED`, `REJECTED`) dynamically.
- **Backward Compatibility**: Maintains a fallback `photo` string url key pointing to the designated primary photo url while introducing `photos` array serialization inside [serializers.py](file:///c:/Users/ullas/Desktop/Company%20projects/matiromony/backend/apps/accounts/serializers.py).

### 11. Frontend UI & Layout Audit Summary

The administrative, support, and member interfaces have been fully audited, cleaned of mixed CSS/inline declarations, and verified for production compliance:

| Page / Component | Route Path | Layout Shell | Current Styling Method | Broken UI Behavior / Gaps | Duplicate Controls | Missing States | API Dependencies | Status | Fix Performed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **All Administrative Screens** | `/admin/*`, `/super-admin/*`, `/staff/*`, `/customer-support/*` | `AdminLayout` | Tailwind CSS | Sidebar nav links reset the scroll position to the top. | Duplicate Sign Out links (in header profile menu and standalone footer logout buttons). | Sidebar scroll position is not retained. Collapsed states reset. | `useAuth`, `/admin/settings/`, `/admin/backups/` | **Audited** | Removed `key={location.pathname}` from App.tsx, preserved scroll via `sessionStorage` ref hook in `AdminLayout.tsx`. |
| **Staff Creation Modals** | `/admin/staff` | `AdminLayout` | Tailwind CSS | Select dropdown lists for Department/Designation appear blank. Changing department leaves incompatible designations. | Duplicate Save and Cancel triggers. | Designation value resets are not handled automatically. | `/admin/departments/`, `/admin/designations/` | **Audited** | Integrated dynamic reset effects when department changes. CustomerSupport creation modals removed. |
| **Route Protection & Guards** | Restricted Admin Paths | `ProtectedRoute` | Tailwind CSS | Restricted routes open as empty whitespace or perform redirects without user explanation. | None | Graceful custom error screens. | `useAuth`, `/me/` | **Audited** | Upgraded `ProtectedRoute.tsx` to render a detailed `PermissionDenied` page instead of hard redirect. |
| **Real-time Member Chat** | `/messages` | `Member layout` | Tailwind CSS | Chat is not real-time. Conversations list only loads via standard HTTP GET with no live messages broadcast. | Duplicate chat action selectors. | Real-time WebSocket handlers, offline polling fallback indicators. | `/conversations/`, `/messages/` | **Audited** | Integrated active WebSocket connections using versioned token params and interval-polling fallback listeners. |
| **Platform Settings** | `/super-admin/settings` | `AdminLayout` | Tailwind CSS | Settings panels are missing general and feature control options. Secrets are exposed. | Duplicate Save buttons. | Configured masks for SMTP passwords and environment controlled keys. | `/admin/settings/` | **Audited** | Formatted tabs to hide configuration secrets and alert users when environment configurations are locked. |
| **Super Admin Memberships** | `/super-admin/memberships` | `AdminLayout` | Tailwind CSS | Sorting queries on MembershipPlan model crashed. pricing, durations, and details were missing. | None | Configurable limits and entitlement rules (profile views, message capabilities, access modes). | `/super-admin/membership-plans/` | **Audited** | Upgraded database models and entitlements logic, registered canonical APIs, and redesigned list & forms in AdminMembershipsPage.tsx. |
| **Roles & Permissions Matrix** | `/super-admin/roles` | `AdminLayout` | Tailwind CSS | Direct checklists were confusing and raw. Lacked role purpose and module scopes. | None | Comparison side-by-side modal. Side drawer permission configs. Global search jump drawers. Unsaved draft bottom sticky actions bar. | `/super-admin/roles/` | **Audited** | Completely redesigned into a 3-column enterprise SaaS configuration workspace with slide-out side drawers, role directories, and comparison matrices. |

---

## 12. Member Lifecycle & Separate Statuses

### Isolated Status States
To prevent field overloading, individual lifecycles are isolated across separate DB columns on the Member model:
- **AccountStatus**: `ACTIVE`, `SUSPENDED`, `ARCHIVED`, `DELETED`
- **ProfileStatus**: `DRAFT`, `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `RESUBMITTED`
- **PhotoStatus**: `PENDING`, `APPROVED`, `REJECTED`, `ARCHIVED`
- **DocumentStatus**: `NOT_UPLOADED`, `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`
- **MembershipStatus** (on `MemberMembership`): `FREE`, `PAYMENT_PENDING`, `PENDING_VERIFICATION`, `ACTIVE`, `EXPIRED`, `CANCELLED`, `REFUNDED`

### Gated Verification Checks
All matchmaking, messaging, search, and detail views are protected behind the `IsVerifiedMember` permission. The user must satisfy:
1. `profile_status == 'APPROVED'`
2. `is_email_verified == True` and `is_mobile_verified == True`
3. Primary photo approved: `photos.filter(is_primary=True, status='APPROVED').exists()`
4. KYC document approved: `documents.filter(status='APPROVED').exists()`

When a payment succeeds, if these checks are not yet fully passed, the membership is placed in `PENDING_VERIFICATION` status (does not consume paid time, does not set start/end dates). Once the final check is approved in the staff verification workflow, the membership automatically transitions to `ACTIVE`, starting the paid period.

### Razorpay checkout
- Integrates frontend client-side overlay with Razorpay checkout SDK (`checkout.js`).
- Backend order creation (`/payments/create-order/`) and verification (`/payments/verify/`) with automated sandbox credentials forwarding in development/debug environments.

---

## 13. Compatibility Matching Engine & AstroTalk Integration

The compatibility matching engine computes match percentages and explanatory bullet points between viewing members and prospective partners.

### Architecture

The engine is designed as a modular provider-driven system:
- **Interface Base**: `CompatibilityProvider` in `backend/apps/core/matching.py` defines the base contract `calculate(viewer, target)`.
- **Active Engine**: `RuleBasedCompatibilityProvider` implements basic scoring (age range, location/city overlap, religion/community, education level, and marital status).
- **Environment Variable**: Configure the active engine using `COMPATIBILITY_PROVIDER` in settings/env (defaults to `rule_based`).

### Future AstroTalk Integration

To integrate AstroTalk or any external astrological matching engine:
1. Define a new provider subclass, e.g. `AstroTalkCompatibilityProvider(CompatibilityProvider)`.
2. Configure external client authorization tokens and API URLs via environment variables.
3. Update `get_compatibility_provider()` to return the `AstroTalkCompatibilityProvider` when `COMPATIBILITY_PROVIDER=astrotalk` is configured.
4. Serializer representations and detail view APIs will remain completely unchanged, ensuring decoupling between views and external providers.
