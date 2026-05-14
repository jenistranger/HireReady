# Roadmap: Pages, PostgreSQL, Auth, Billing

## Goal

Turn the current working HireReady MVP into a multi-page product with public landing, protected app usage, PostgreSQL-backed users/sessions/limits, and a pricing page prepared for future YooKassa payments.

The first implementation should not store resume text, job descriptions, generated PDFs, or generation history. Store only account/session/usage data needed for login and free limits.

## Target Routes

### `/`

Public landing page.

Purpose:
- explain what HireReady does;
- show the main value proposition;
- describe the flow: upload or paste resume, paste vacancy, get tailored resume, download PDF;
- link to `/app` with a primary CTA;
- link to `/pricing`.

Requirements:
- no auth required;
- mobile-first layout;
- real product signals, not a generic marketing page;
- include RU/EN language support if current app language switch remains global.

### `/app`

Main product page.

This is the current app screen with resume input, job input, generation, preview, templates, photo upload, and PDF download.

Requirements:
- page is viewable without login;
- AI generation requires login;
- if unauthenticated user clicks generate or improve, show login modal;
- after login, return user to `/app` and continue normal usage;
- do not require login just to type into forms.

### `/pricing`

Pricing and payment page.

First version is a placeholder, not real payment.

Requirements:
- public page;
- show Free plan and Pro plan;
- Free plan shows daily generation limit;
- Pro plan button says payment via YooKassa is coming soon;
- no money is charged in this phase;
- link back to `/app`.

## Frontend Plan

### Routing

Add `react-router-dom`.

Create a route shell:
- `LandingPage` for `/`;
- `AppPage` for `/app`;
- `PricingPage` for `/pricing`;
- fallback route redirects or renders landing.

Refactor current `App.jsx`:
- keep global language state and `LangContext` at the top-level app shell;
- move the current product UI into `AppPage`;
- keep existing component behavior unchanged unless auth gating requires a small prop change.

### Navigation

Update the navbar so it supports:
- logo link to `/`;
- links to `/app` and `/pricing`;
- language switch;
- login button when unauthenticated;
- user menu or compact profile button when authenticated;
- logout action.

The current profile modal is static. Replace or adapt it so it displays real user data from `/api/auth/me` once auth exists.

### Auth UI

Add a login modal with two provider buttons:
- Continue with Google;
- Continue with Yandex.

Clicking a provider redirects to:
- `/api/auth/google/start`;
- `/api/auth/yandex/start`.

Client API additions:
- `getCurrentUser()`;
- `logout()`;
- `getBillingStatus()`;
- `checkoutPlaceholder()`.

Generation behavior:
- before `tailorResume` or `improveResume`, check auth state;
- if not logged in, open login modal and do not call AI endpoint;
- if backend returns `401`, open login modal;
- if backend returns limit error, send user to `/pricing` or show a clear limit message.

## Backend Plan

### Dependencies

Add backend dependencies:
- PostgreSQL driver, preferably `psycopg[binary]`;
- SQLAlchemy if choosing lightweight ORM/table definitions;
- auth helpers can use standard library plus `httpx`; avoid adding a large auth framework unless needed.

Keep the implementation simple and explicit.

### Environment Variables

Required:
- `DATABASE_URL`;
- `APP_BASE_URL`;
- `SESSION_SECRET`;
- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `YANDEX_CLIENT_ID`;
- `YANDEX_CLIENT_SECRET`;
- `FREE_DAILY_GENERATIONS`.

Existing:
- `openrouter_api_key`;
- `DEV_MODE`;
- `ALLOWED_ORIGINS`.

Future YooKassa:
- `YOOKASSA_SHOP_ID`;
- `YOOKASSA_SECRET_KEY`.

### Database Tables

Use PostgreSQL from the first version.

#### `users`

Fields:
- `id`;
- `email`;
- `name`;
- `avatar_url`;
- `created_at`;
- `updated_at`.

Uniqueness:
- email should be unique when present.

#### `oauth_accounts`

Fields:
- `id`;
- `user_id`;
- `provider`;
- `provider_user_id`;
- `email`;
- `created_at`;
- `updated_at`.

Uniqueness:
- unique `(provider, provider_user_id)`.

#### `sessions`

Fields:
- `id`;
- `user_id`;
- `token_hash`;
- `created_at`;
- `expires_at`;
- `last_seen_at`;
- `user_agent`;
- `ip_hash`.

Requirements:
- never store raw session token;
- store only a hash;
- delete or ignore expired sessions.

#### `oauth_states`

Fields:
- `id`;
- `state_hash`;
- `provider`;
- `redirect_after`;
- `created_at`;
- `expires_at`.

Requirements:
- validate state in callback;
- state should be single-use;
- expire quickly.

#### `usage_events`

Fields:
- `id`;
- `user_id`;
- `event_type`;
- `created_at`;
- `metadata_json`.

Initial event types:
- `tailor`;
- `improve`.

Do not store resume text, job text, generated resume, or PDF content in metadata.

#### Future `payments`

Not required now, but leave design room for:
- `user_id`;
- `provider`;
- `provider_payment_id`;
- `status`;
- `amount`;
- `currency`;
- `created_at`;
- `paid_at`.

## Backend API

### Auth

Add endpoints:
- `GET /api/auth/google/start`;
- `GET /api/auth/google/callback`;
- `GET /api/auth/yandex/start`;
- `GET /api/auth/yandex/callback`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`.

Session cookie:
- `HttpOnly`;
- `Secure` in production;
- `SameSite=Lax`;
- path `/`;
- reasonable expiry, for example 30 days.

OAuth flow:
- generate state;
- store state hash in PostgreSQL;
- redirect user to provider;
- receive callback code and state;
- validate state;
- exchange code for token server-side;
- fetch profile;
- upsert user and oauth account;
- create session;
- redirect to `/app` or saved `redirect_after`.

Use official docs:
- Google OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
- Yandex ID OAuth: https://yandex.com/dev/id/doc/en/concepts/ya-oauth-intro

### Billing

Add endpoints:
- `GET /api/billing/status`;
- `POST /api/billing/checkout-placeholder`.

First version behavior:
- returns current plan `free`;
- returns daily generation limit and remaining generations;
- checkout endpoint returns a clear placeholder response, no external payment call.

Future YooKassa docs:
- https://yookassa.ru/en/widget/

### Generation Access Control

Protect:
- `POST /api/tailor`;
- `POST /api/improve`.

Behavior:
- unauthenticated request returns `401`;
- authenticated request checks daily free generation limit;
- if allowed, perform AI call and record usage event only after successful generation;
- if limit is exceeded, return a clear limit response.

Recommended status for exceeded free limit:
- `402 Payment Required` if frontend handles it cleanly;
- otherwise `429` with a product-specific detail message.

PDF endpoint:
- keep preview/render available for now if it only transforms client-provided text;
- consider protecting PDF download later if billing requires it.

## Docker And Deployment

Update `docker-compose.yml`:
- add `postgres` service;
- add volume for Postgres data;
- set `DATABASE_URL` for app service;
- make app depend on postgres.

Example service shape:
- image: `postgres:16-alpine`;
- env vars: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`;
- volume: `postgres_data:/var/lib/postgresql/data`.

Production requirements:
- configure OAuth callback URLs in Google and Yandex consoles;
- callbacks must use real HTTPS domain;
- set `APP_BASE_URL` to production domain;
- set strong `SESSION_SECRET`;
- keep `DEV_MODE=0`.

## Security And Privacy

Rules:
- do not log resume text, job descriptions, generated output, OAuth tokens, or session tokens;
- do not store resume/job/PDF content in PostgreSQL;
- hash session tokens before storing;
- hash IP if storing it at all;
- keep OAuth callback state single-use and short-lived;
- keep existing SSRF protections and rate limits;
- keep request size limits.

Cookies:
- `Secure` should be enabled outside local development;
- `HttpOnly` is required;
- `SameSite=Lax` is enough for OAuth redirects and safer than `None`.

## Implementation Phases

### Phase 1: Frontend Pages

Deliver:
- install router;
- create `/`, `/app`, `/pricing`;
- move current app UI to `/app`;
- update navbar;
- keep existing generation behavior unchanged except route structure.

Verification:
- `rtk npm run build`;
- direct load of `/`, `/app`, `/pricing` works in production container.

### Phase 2: PostgreSQL Foundation

Deliver:
- add DB dependency;
- add connection module;
- add schema initialization or migrations;
- update Docker Compose with Postgres;
- add health check visibility for DB connection if practical.

Verification:
- app starts with Postgres;
- tables are created or migrations run;
- backend tests pass.

### Phase 3: OAuth Sessions

Deliver:
- Google login;
- Yandex login;
- session cookie;
- `/api/auth/me`;
- logout;
- real user display in navbar/profile.

Verification:
- provider callbacks create users;
- logout clears session;
- expired or invalid session returns unauthenticated state.

### Phase 4: Generation Gate And Limits

Deliver:
- require login for AI generation;
- daily free usage counter;
- frontend login modal before generation;
- frontend limit message and link to pricing.

Verification:
- unauthenticated generation does not call AI;
- authenticated generation works;
- usage event is recorded after successful generation;
- daily limit blocks extra generation.

### Phase 5: Pricing Placeholder

Deliver:
- pricing page wired to billing status;
- Pro payment button shows YooKassa-coming-soon placeholder;
- no external payment call.

Verification:
- pricing page reflects current free limit;
- checkout placeholder returns expected response.

## Test Plan

Commands:
- `rtk npm run build` from `frontend/`;
- `rtk pytest backend/tests`;
- `rtk docker compose build`;
- `rtk docker compose up -d`.

Manual checks:
- `/`, `/app`, `/pricing` open directly;
- mobile layout works at 360, 390, and 430 px;
- unauthenticated generation opens login modal;
- Google OAuth login works;
- Yandex OAuth login works;
- `/api/auth/me` returns the logged-in user;
- logout clears auth state;
- free generation limit works;
- pricing placeholder does not charge money;
- existing PDF preview/download still works;
- existing SSRF and size-limit tests still pass.

## Current Decisions

- PostgreSQL is required from the first auth/billing version.
- Login providers: Google and Yandex only.
- Auth is required before AI generation.
- Landing and pricing remain public.
- Payment provider target: YooKassa.
- YooKassa is not integrated in the first implementation; pricing is a placeholder.
- Resume text, job descriptions, generated resumes, and PDFs are not stored.
