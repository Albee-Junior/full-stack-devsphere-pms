# DevSphere

DevSphere is a workspace for project teams, students, educators, freelancers, and small businesses. The React/Vite frontend and PostgreSQL/Express API are separate projects: the frontend is in this folder and the API is in the sibling [`backend-devsphere`](../backend-devsphere/README.md) folder.

## Local setup (Windows)

Requirements: Node.js 20+ and npm. Start PostgreSQL with Docker Compose (or install PostgreSQL yourself).

```powershell
npm install
Copy-Item ..\backend-devsphere\.env.example ..\backend-devsphere\.env
Set-Location ..\backend-devsphere
docker compose up -d
npm install
Set-Location ..\devsphere
npm run dev
```

The app runs at `http://localhost:5173`; Express and Socket.IO run at `http://localhost:3001`. Vite proxies `/api` and `/socket.io`. The local PostgreSQL connection defaults in the backend example environment are for development only.

On the first development start, a demo workspace is seeded:

- Email: `demo@devsphere.local`
- Password: `devsphere123`

Change the demo credentials in the backend environment before sharing the database. New accounts get a guided setup for role, field, team size, and workflow.

## Moving existing SQLite data

The original SQLite database is not changed by the migration. Start the new PostgreSQL service, set `DATABASE_URL` in `backend-devsphere/.env`, then run:

```powershell
npm --prefix ..\backend-devsphere run migrate:sqlite
```

The migration reads `devsphere/data/devsphere.sqlite` by default. Set `SOURCE_SQLITE_PATH` in the backend environment to use a different file. Back up the SQLite file before migration and verify your data before removing any old copy.

## Features

- Project detail views with every task, ownership, deadlines, progress, and per-task status updates.
- Drag-and-drop Kanban status changes, with buttons retained for keyboard and touch users.
- Workspace messaging, calendar, realtime collaboration, code studio, whiteboard, and WebRTC huddles.
- A notification center with unread counts and workspace activity.
- Guided onboarding and editable workspace preferences for students, educators, researchers, freelancers, and business teams.
- Study task planning; editable contract-draft templates; workspace files and folders; and a resource marketplace.
- Pricing and checkout setup for USD cards through Stripe and GHS cards/mobile money through Paystack.
- Community discussions, platform news, and an assistant that summarizes workspace data locally.

Contract templates are drafts, not legal advice. Resource listings do not include seller verification or seller payouts. Checkout requires merchant accounts, secrets, and verified webhooks; no payment credentials are included in source. USD plans use Stripe subscriptions. GHS plan payments grant 30 days and require manual renewal. Mobile-money and card availability depends on your Paystack merchant account and customer region.

## Production setup

1. Build the client with `npm run build`.
2. Set `NODE_ENV=production`, `DATABASE_URL`, a long random `JWT_SECRET`, `CLIENT_ORIGIN`, and `PUBLIC_APP_URL` in the backend environment.
3. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for USD cards and/or `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` for GHS.
4. Run `npm start` from the frontend folder to start the backend, or run `npm start` in `backend-devsphere`.
5. Persist PostgreSQL and `backend-devsphere/uploads`; deploy behind HTTPS. Configure TURN for calls on restrictive networks.

The backend serves the frontend `dist` build in production. Keep `.env` files and uploads private; do not commit payment secrets.

## Useful commands

```sh
npm run dev       # frontend and separate API
npm run dev:web   # frontend only
npm run server    # API only
npm run build     # production frontend build
npm run lint      # frontend and backend lint
```

API, database, Docker Compose, migration, payment webhook, and upload setup details are in [`backend-devsphere/README.md`](../backend-devsphere/README.md).

For frontend-specific install, test, build, and preview instructions, see [FRONTEND.md](./FRONTEND.md). The step-by-step Bruno walkthrough is in [the backend testing guide](../backend-devsphere/TESTING.md).
