# DevSphere

DevSphere is maintained as two sibling applications:

- `devsphere/` contains the React/Vite frontend.
- `backend-devsphere/` contains the Express, Socket.IO, and PostgreSQL backend.

## Run locally

1. Follow `backend-devsphere/README.md` to configure the backend environment and start PostgreSQL.
2. Start the API from `backend-devsphere/` with `npm run dev`.
3. Start the frontend from `devsphere/` with `npm run dev`.
4. Open `http://localhost:5173`.

The **Student dashboard** supports private course and assignment tracking, text/link submissions, and personal grade records.
