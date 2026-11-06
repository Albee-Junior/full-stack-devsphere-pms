# DevSphere backend

The Express 5 API, Socket.IO server, PostgreSQL schema, upload storage, and checkout integrations live here, separately from the Vite frontend.

## What you need to provide

| Setting                          | Required?                             | Where to get it / use                                                                                                                       |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 22 LTS and npm           | Yes                                   | Install locally. Node.js 20.19+ is also supported by the frontend tooling.                                                                  |
| PostgreSQL 15+                   | Yes to run the real API               | Easiest local option is Docker Desktop with WSL 2. Alternatively install PostgreSQL and create a database/user.                             |
| `DATABASE_URL`                   | Yes                                   | PostgreSQL connection string, e.g. the local value in `.env.example`; for your own server replace user, password, host, port, and database. |
| `JWT_SECRET`                     | Yes for a safe local deployment       | Generate a private random value; never commit or send it in chat.                                                                           |
| `CLIENT_ORIGIN`                  | Required for cross-origin browser use | Frontend origin, usually `http://localhost:5173` locally.                                                                                   |
| Stripe keys and webhook secret   | Optional                              | Only needed to enable/test USD card checkout. Get test-mode values from your Stripe dashboard.                                              |
| Paystack keys and webhook secret | Optional                              | Only needed to enable/test GHS card/mobile-money checkout. Get test-mode values from your Paystack dashboard.                               |
| SQLite file path                 | Optional                              | Only if migrating existing data; set `SOURCE_SQLITE_PATH` to the old file.                                                                  |

No separate AI key is needed: the current assistant summarizes workspace information locally.

## Student coursework API

Authenticated student coursework is private to the signed-in user, even when multiple users share a workspace:

- `GET /api/student/dashboard` returns courses, assignments, submission details, grades, and summary counts.
- `POST /api/student/courses` creates a course (`name`, optional `instructor`, and `term`).
- `POST /api/student/assignments` creates a course assignment (`courseId`, `title`, optional `description`, `dueDate`, and `pointsPossible`).
- `POST /api/student/assignments/:id/submissions` submits text, a link, or both. Resubmission replaces the earlier work and clears its previous grade.
- `POST /api/student/assignments/:id/grades` records a score and optional instructor feedback for the student's private grade tracker.

Students record grades they receive elsewhere; this API does not claim to verify grades with an institution.

## Local setup on Windows

### Option A: Docker Desktop (recommended)

1. Install Node.js 22 LTS and Docker Desktop. Start Docker Desktop and make sure its Linux container engine is running.
2. Open PowerShell and copy the backend environment example:

   ```powershell
   Set-Location D:\Courses-Projects\backend-devsphere
   Copy-Item .env.example .env
   ```

3. Edit `D:\Courses-Projects\backend-devsphere\.env`. For the Docker Compose database, keep the example `DATABASE_URL` that points to `localhost:5432/devsphere`; change `JWT_SECRET` to a private value. You can generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Put the printed value after `JWT_SECRET=` in `.env`. The provided PostgreSQL username/password in `.env.example` match `compose.yaml` and are for local development only.

4. Start PostgreSQL and wait until it is healthy:

   ```powershell
   npm run db:up
   docker compose ps
   ```

5. Install backend packages and start the API:

   ```powershell
   npm install
   npm run dev
   ```

6. In a second PowerShell window, confirm the API is ready:

   ```powershell
   Invoke-RestMethod http://localhost:3001/api/health
   ```

   It should return `status: ok`. The schema is applied at startup. A new development database gets a demo workspace (`demo@devsphere.local` / `devsphere123`).

7. Start the frontend in a second terminal if needed:

   ```powershell
   Set-Location D:\Courses-Projects\devsphere
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

### Option B: Existing PostgreSQL server

1. Create a PostgreSQL database and user, and make sure the server accepts connections from this computer.
2. Copy `.env.example` to `.env` as above.
3. Replace `DATABASE_URL` with your own connection string:

   ```text
   postgres://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:5432/YOUR_DATABASE
   ```

   URL-encode special characters in the username/password. Set `DATABASE_SSL=true` only when your server requires TLS with a certificate trusted by Node.js.

4. Set a private `JWT_SECRET`, leave payment keys blank unless enabling checkout, then run `npm install` and `npm run dev`.

## Tests and checks

From `backend-devsphere`:

```powershell
npm test
npm run lint
```

The API integration test uses `pg-mem` and exercises auth, invitations, onboarding preferences, projects/tasks, student courses/assignments/submissions/grades, notifications, messages, events, assistant limits, community, groups, extensions, blog, contracts, analytics, CRM, pricing, and file upload/download. It does not need a local PostgreSQL server and does not change your real database.

From `devsphere`, `npm test` runs the frontend tests and `npm run lint` checks both projects. The Bruno collection and guided API walkthrough are in [TESTING.md](./TESTING.md) and [bruno/](./bruno/).

## Bruno API checks

1. Start PostgreSQL and the backend using the steps above.
2. Open Bruno and choose **Open Collection** for `D:\Courses-Projects\backend-devsphere\bruno`.
3. Select the **Local** environment.
4. Run **Health**, then **Login**. Login saves the returned JWT into the environment.
5. Run **My account**, **Projects**, **Message channels**, **Notifications**, **Public content**, **Billing plans**, **Workspace usage**, **Groups**, and **Extensions**.
6. To test student coursework, run **Add student course**, **Add student assignment**, **Submit student assignment**, **Record student grade**, then **Student dashboard** in order.
7. To test other writes, run **Create project**, **Create task**, then **Update task** in order. These create development data in PostgreSQL.
8. Optionally run **Create group** and **Install free extension** to verify these workspace tools.

## Existing SQLite data migration

Back up the existing SQLite file first. Start PostgreSQL and set `SOURCE_SQLITE_PATH` if the old database is not at the default path. Then run from the frontend folder:

```powershell
Set-Location D:\Courses-Projects\devsphere
npm --prefix ..\backend-devsphere run migrate:sqlite
```

The migration copies rows in a transaction and does not modify the SQLite source. Review row counts and verify data before retiring the old database.

## Payments and production

Payments are not required to run the app. For test checkout, configure the relevant provider's test secret and webhook signing secret only in `backend-devsphere/.env`; never put payment secrets in frontend variables. Configure webhook endpoints `/api/billing/webhooks/stripe` or `/api/billing/webhooks/paystack`. USD uses Stripe subscriptions. GHS plan payments grant 30 days and require manual renewal; available Paystack channels depend on merchant eligibility. Seller payouts, taxes, and refunds are not implemented.

For production, also provide `NODE_ENV=production`, a strong `JWT_SECRET`, PostgreSQL credentials, real `CLIENT_ORIGIN` and `PUBLIC_APP_URL`, HTTPS, persistent PostgreSQL and upload storage, and verified payment webhooks if payments are enabled. Do not use the demo account or development database credentials in production.

## Troubleshooting

- **`DATABASE_URL is not set`**: `.env` is missing, in the wrong folder, or has no `DATABASE_URL`. Copy `backend-devsphere/.env.example` to `backend-devsphere/.env` and check the value.
- **Connection refused / `ECONNREFUSED`**: PostgreSQL is not running or the host/port is wrong. With Docker, check `docker compose ps` and `docker compose logs postgres`.
- **Password authentication failed**: match `DATABASE_URL` credentials to your PostgreSQL user. The Compose defaults apply only to the Compose database volume.
- **Port 3001 is in use**: stop the other API process or set a different `PORT` in `.env` and update Vite's `/api` and `/socket.io` proxy targets.
- **Bruno gets 401**: run **Login** again and verify the **Local** environment is selected.
- **Docker commands are unavailable**: install and start Docker Desktop, or use Option B with an installed PostgreSQL server.

The test database uses an in-memory PostgreSQL compatibility layer and is not a replacement for the real PostgreSQL server required by `npm run dev`.

## Commands

```powershell
npm run db:up
npm run dev
npm start
npm test
npm run lint
npm run migrate:sqlite
```
