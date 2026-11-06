# DevSphere development and operations guide

This guide covers the frontend, backend, database, paid tiers, payments, and a safe workflow for adding features. Commands use Windows PowerShell.

## 1. Project layout

| Area | Important files | Responsibility |
|---|---|---|
| React/Vite entry and routes | `src/App.jsx`, `src/main.jsx` | App shell, page registry, signed-in navigation |
| Feature screens | `src/pages/` | Page UI and feature-specific state |
| Shared layout | `src/components/layout/` | Sidebar, header, and workspace shell |
| API client | `src/api/http.js` | JSON requests, auth headers, upload and error handling |
| Visual system | `src/styles/`, `src/App.css` | Tokens, responsive UI, dark theme and page styles |
| Express routes | `backend-devsphere/src/routes/` | HTTP endpoints and request validation |
| Route registration | `backend-devsphere/src/routes/index.js` | API URL-to-router wiring |
| Services/policies | `backend-devsphere/src/services/` | Plans, payments, shared business rules |
| SQL schema | `backend-devsphere/src/db/schema.sql` | PostgreSQL tables, indexes, idempotent schema setup |
| Data access | `backend-devsphere/src/db/database.js` | PostgreSQL pool, SQL parameter binding, transactions |
| Automated tests | `devsphere/tests/`, `backend-devsphere/tests/` | UI behavior and API integration regression tests |
| API collection | `backend-devsphere/bruno/` | Bruno requests and Local environment |

`javascript-course/DevSphere/` is the supplied static HTML/CSS reference prototype. Its public landing-page copy and concepts have been carried into the React app; the integrated React app and Express API are the source of truth for runtime behavior and data.

## 2. First-time setup

1. Install Node.js 22 LTS, npm, and PostgreSQL 15+ (or Docker Desktop).
2. In PowerShell, prepare backend configuration:

   ```powershell
   Set-Location D:\Courses-Projects\backend-devsphere
   Copy-Item .env.example .env
   ```

3. Edit `backend-devsphere\.env`. Set a private random `JWT_SECRET`, valid `DATABASE_URL`, and `CLIENT_ORIGIN=http://localhost:5173`. Do not commit `.env`.
4. Start PostgreSQL and the API:

   ```powershell
   npm run db:up
   npm run dev
   ```

5. In another PowerShell terminal:

   ```powershell
   Set-Location D:\Courses-Projects\devsphere
   npm install
   npm run dev
   ```

6. Visit `http://localhost:5173`. Verify `http://localhost:3001/api/health` returns `{"status":"ok","service":"devsphere-api"}`.

Fresh development data includes `demo@devsphere.local` / `devsphere123`; change or disable demo credentials before exposing any environment outside local development.

## 3. Safe step-by-step workflow for changing code

1. **Identify the owner.** Search the feature page, its API methods, route, shared plan policy, tests, and database table before editing.
2. **Implement the backend rule first** for any data, permission, quota, or paid-feature requirement. Treat frontend checks as user experience only.
3. **Keep the UI in its feature page.** Add shared controls/layout only when multiple pages genuinely use them. Use the existing API helpers (`get`, `post`, `put`, `patch`, `remove`, `uploadFile`) rather than creating a second token/fetch client.
4. **For a new API route:** add a route file under `backend-devsphere/src/routes/`, apply `authenticateToken` and workspace scoping, validate input, and register it in `src/routes/index.js`.
5. **For a schema change:** add a safe, repeatable statement to `src/db/schema.sql`; prefer `CREATE TABLE IF NOT EXISTS`, indexes, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Back up production data and test against a copy before deploying schema changes.
6. **For a paid feature or quota:** update `src/services/planAccess.js`, return accurate entitlements from `/api/workspace/usage` and `/api/billing/plans`, enforce on the relevant route, and update the Pricing page and user guide together.
7. **Add regression tests** for the success path, invalid input, workspace isolation, and denied/at-limit cases.
8. **Run checks** from `devsphere`:

   ```powershell
   npm test
   npm run lint
   npm run build
   ```

9. **Exercise the API in Bruno** using `backend-devsphere\bruno`; run Health and Login first, then feature requests.
10. **Review dark mode and a mobile viewport**, check errors/empty states, and verify that no API secret or workspace data is exposed to another account.

### Safe changes vs. files to treat carefully

**Normal feature work:** add/edit a focused page in `src/pages/`, a matching route in `backend-devsphere/src/routes/`, styles in the app stylesheets, tests, and documentation.

**Treat these as shared infrastructure; change only for a clear, tested reason:**

- `src/api/http.js`: centralized token handling, request errors, and multipart uploads.
- `backend-devsphere/src/middleware/auth.js`: all API workspace identity and token verification.
- `backend-devsphere/src/db/database.js`: SQL placeholder conversion, ID behavior, and transactions.
- `backend-devsphere/src/db/schema.sql`: production data structure and indexes.
- `backend-devsphere/src/services/planAccess.js`: limits and feature authorization.
- `backend-devsphere/src/services/payments.js`: provider checkout and webhook lifecycle.
- `backend-devsphere/src/app.js` / `src/server.js`: middleware order, webhook raw-body handling, sockets, and startup.

**Do not manually edit or commit:** `node_modules/`, generated `devsphere/dist/`, backend `uploads/`, local `.env`, or payment/JWT credentials. Change package manifests only when dependencies really change, then regenerate the corresponding lockfile with npm. Do not replace auth or database helpers with ad-hoc implementations.

## 4. Current paid plan rules

| Limit | Free | Pro | Business |
|---|---:|---:|---:|
| Storage | 5 GiB | 100 GiB | 1 TiB |
| Projects | 5 | 100 | 500 |
| Tasks | 100 | 5,000 | 25,000 |
| Members (including unaccepted, unexpired invites) | 3 | 10 | 50 |
| Files | 250 | 10,000 | 100,000 |
| Folders | 50 | 1,000 | 10,000 |
| Groups | 3 | 25 | 100 |
| AI requests/day | 10 | 500 | 5,000 |
| Paid feature set | Core tools | AI, Whiteboard, Huddle, Contracts | Pro features + Analytics and CRM |

The backend enforces project/task/member/file/folder/group/storage quotas at write points and checks paid features before serving routes. Extensions are catalogued with minimum plan requirements and enforced when installed. The UI displays quotas and routes locked navigation to Pricing. Existing data is not automatically deleted after a downgrade; access to a paid tool is denied and new writes stop when a quota is exceeded. AI usage is counted per workspace and UTC calendar day.

Plan definitions live in `backend-devsphere/src/services/planAccess.js`; subscription prices in cents live in `backend-devsphere/src/services/payments.js`. If changing either, update the plan response, UI copy, Help Center, `docs/USER_GUIDE.md`, backend tests, and this table together.

## 5. Payment setup and plan lifecycle

### Provider setup

1. Create Stripe and/or Paystack test accounts. Keep secret keys out of frontend variables and source code.
2. Add provider **test** secrets only to `backend-devsphere\.env`:
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`
3. Set `PUBLIC_APP_URL=http://localhost:5173`, restart the backend, and check `GET /api/billing/plans`. The provider's `configured` flag should be true for the configured currency.
4. Configure signed webhooks to reach:
   - Stripe: `POST /api/billing/webhooks/stripe`
   - Paystack: `POST /api/billing/webhooks/paystack`
5. For local Stripe webhooks, install/use the Stripe CLI, run `stripe listen --forward-to localhost:3001/api/billing/webhooks/stripe`, and place the CLI's printed signing secret in `STRIPE_WEBHOOK_SECRET`. Restart the backend after changing `.env`.
6. Test with provider test mode only. A successful browser redirect is not proof of payment; DevSphere activates access only after provider verification/webhook handling.

### Test a customer payment

1. Sign in, open Pricing (or use the **Pro** header button), and choose USD or GHS.
2. Select Pro or Business. Stripe uses monthly USD subscriptions; Paystack GHS checkout grants 30 days and needs manual renewal.
3. Complete the provider's test checkout flow.
4. Confirm the provider webhook reached the API, then return to Pricing and wait for status to show paid/active.
5. Verify `/api/workspace/usage` returns the updated plan/features and test a previously locked page.
6. Use **Cancel plan** to test cancellation. Stripe cancellation is scheduled to the end of the provider period; GHS cancellation keeps access until the recorded expiry.

There is one paid subscription per workspace. A new paid checkout is rejected while a paid period is active; cancel the current subscription and wait for its end before selecting another tier. GHS is manual renewal. Checkout availability, mobile-money options, refunds, tax handling, and seller payouts depend on provider credentials and are not implemented as platform guarantees.

### Payment code ownership and review

- Checkout amount/provider validation and provider sessions: `services/payments.js` / `routes/billing.js`.
- Webhook signature and payment confirmation: `services/payments.js`; never trust a client redirect or a client-supplied "paid" flag.
- Subscription state/expiry and cancellation controls: `workspace_subscriptions` in `db/schema.sql`, billing routes, and `getWorkspacePlan()` in `services/planAccess.js`.
- Frontend display and user action: `devsphere/src/pages/PricingPage.jsx`.

Never log or share a provider secret. Rotate any key that accidentally leaves the provider dashboard or `.env`.

## 6. Bruno API testing

1. Start PostgreSQL and the backend.
2. In Bruno choose **Open Collection** and select `D:\Courses-Projects\backend-devsphere\bruno`.
3. Choose **Local** environment. Change email/password there only if your development demo account differs.
4. Run **Health**, then **Login**. Login stores `token` for later requests.
5. Run **Workspace usage**, **Billing plans**, **Projects**, **Files and folders**, **Message channels**, **Notifications**, **Public content**, **Groups**, and **Extensions**.
6. For write flow, run **Create project** → **Create task** → **Update task**. IDs are stored in the Local environment.
7. **Analytics**, **CRM contacts**, and **Create CRM contact** require Business; contract/whiteboard/huddle APIs require Pro. Paid extensions also return `403` below their listed minimum plan. On a Free workspace, a `403` for a paid feature is expected.
8. Write requests create development data. Clean up from the app or delete the test records when done.

Full automated and manual test details are in `backend-devsphere/TESTING.md`.
