/;# DevSphere frontend

The frontend is a React 19 + Vite application. The Express/PostgreSQL backend is maintained separately in the sibling `backend-devsphere` folder.

## Requirements

- Node.js 22 LTS (Node.js 20.19 or newer is also supported) and npm.
- A running DevSphere API for sign-in and workspace features. See [the backend setup guide](../backend-devsphere/README.md).

## Install and run

From PowerShell:

```powershell
Set-Location D:\Courses-Projects\devsphere
npm install
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` and `/socket.io` to `http://localhost:3001`. Start the backend separately if it is not already running:

```powershell
Set-Location D:\Courses-Projects\backend-devsphere
npm run dev
```

When signed out, the app opens on the public landing page. Use **Sign in** or **Get started** to open authentication. A fresh development database is seeded with `demo@devsphere.local` / `devsphere123`.

The **Student dashboard** in the sidebar tracks courses, due dates, assignment submissions (written work or a link), and grades entered from a course portal or instructor. This data is private to the signed-in user.

## Checks

```powershell
Set-Location D:\Courses-Projects\devsphere
npm test
npm run lint
npm run build
```

`npm test` runs the frontend Vitest and Testing Library tests. `npm run lint` checks frontend source/tests and the sibling backend source/tests. `npm run build` makes a production client bundle in `dist`.

## Production preview

```powershell
Set-Location D:\Courses-Projects\devsphere
npm run build
npm run preview
```

Vite's preview serves the static client only; API operations still require the backend. For production hosting, configure the backend to serve this folder's `dist` output and set the backend's `CLIENT_ORIGIN` and `PUBLIC_APP_URL` to the actual HTTPS site origin.
