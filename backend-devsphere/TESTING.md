# DevSphere test guide

This guide covers automated checks, browser testing, and API testing with Bruno. Commands are for PowerShell on Windows.

## 1. Start the database and app

Use the [backend setup guide](./README.md) to create `backend-devsphere/.env` and start PostgreSQL. For Docker Desktop, from the backend folder:

```powershell
Set-Location D:\Courses-Projects\backend-devsphere
Copy-Item .env.example .env
npm run db:up
npm run dev
```

In another terminal, start the frontend:

```powershell
Set-Location D:\Courses-Projects\devsphere
npm run dev
```

Open `http://localhost:5173`. Check API readiness at `http://localhost:3001/api/health`. On a fresh development database, demo sign-in is `demo@devsphere.local` / `devsphere123`.

## 2. Run the automated test suites

From the frontend folder, run all tests in both projects:

```powershell
Set-Location D:\Courses-Projects\devsphere
npm test
```

To run tests separately:

```powershell
npm run test:watch

Set-Location D:\Courses-Projects\backend-devsphere
npm test
```

The frontend suite uses Vitest, jsdom, and Testing Library and covers the landing page, signed-out entry flow, and pricing/payment controls. The backend integration suite uses an isolated in-memory PostgreSQL-compatible database; it covers auth, invitations, onboarding, projects/tasks, notifications, messages, events, assistant limits, community, groups, extensions, blog, contracts, analytics, CRM, pricing, and file upload/download. These automated tests do not require your real PostgreSQL server or payment-provider keys.

Then run quality checks:

```powershell
Set-Location D:\Courses-Projects\devsphere
npm run lint
npm run build
```

## 3. Open and run the Bruno collection

1. Start PostgreSQL and the backend as described above.
2. Open Bruno.
3. Select **Open Collection**, then choose `D:\Courses-Projects\backend-devsphere\bruno`.
4. Select the **Local** environment in Bruno.
5. Run **Health**. A `200` response with `status: "ok"` means the API is reachable.
6. Run **Login**. It uses the demo credentials configured in the Local environment and automatically saves the returned token.
7. Run **My account**, **Projects**, **Message channels**, **Notifications**, **Public content**, **Billing plans**, **Workspace usage**, **Groups**, and **Extensions**. Authenticated requests use the saved token.
8. To test student coursework, run **Add student course**, **Add student assignment**, **Submit student assignment**, and **Record student grade** in order, then inspect **Student dashboard**. The first two requests save their IDs to the Bruno environment.
9. Run **Create project**, then **Create task**, then **Update task**, in that order. To try group/extension writes, run **Create group** and **Install free extension**; the collection saves the created group ID.

The write requests add records to your development database. Remove them later through the app if you do not need them.

## 4. Exercise the app manually

1. Use the signed-out landing page and its anchor navigation; try the **Sign in** and **Get started** actions.
2. Sign in with the demo account and complete onboarding if this is a fresh database.
3. Click a project to view its details and tasks. Create a test task, then move it with drag-and-drop or the status controls.
4. Check notifications after changing project/task data.
5. Try messaging, calendar, community groups, extensions, file upload/download, Study Hub, the Student dashboard (add a course, add an assignment, submit work, record a grade), contract drafts, resources, and pricing.
6. Check a narrow/mobile viewport and the dark theme from Settings.

Live payment tests need Stripe/Paystack test credentials and webhook signing secrets; payments are optional for the rest of the app.

## 5. If a check fails

- API will not start: follow the `DATABASE_URL` and PostgreSQL troubleshooting section in the [backend setup guide](./README.md).
- Bruno gets `401`: run **Login** again and verify **Local** is selected.
- Bruno cannot connect: check `http://localhost:3001/api/health` and verify the backend is running.
- Frontend API calls fail: make sure the API is on port 3001 and the Vite app is on port 5173.
- Port 3001 is busy: set another `PORT` in backend `.env` and update the `/api` and `/socket.io` Vite proxy targets to match.
