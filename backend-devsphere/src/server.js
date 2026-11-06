import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, db, initializeDatabase } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";

await initializeDatabase();
await seedDatabase();

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin.split(",").map((origin) => origin.trim()), credentials: true },
});

io.use(async (socket, next) => {
  let payload;
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required."));
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new Error("Your session has expired."));
  }
  try {
    const user = await db.prepare('SELECT id, workspace_id AS "workspaceId", name FROM users WHERE id = ?').get(payload.sub);
    if (!user) return next(new Error("Your session is no longer valid."));
    socket.data.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user;
  const workspaceRoom = `workspace:${user.workspaceId}`;
  socket.join(workspaceRoom);

  socket.on("call:join", (room) => {
    if (typeof room !== "string" || room.length > 80) return;
    const callRoom = `${workspaceRoom}:call:${room}`;
    socket.join(callRoom);
    socket.to(callRoom).emit("call:peer-joined", { peerId: socket.id, name: user.name });
    const peers = [...(io.sockets.adapter.rooms.get(callRoom) || [])].filter((peerId) => peerId !== socket.id);
    socket.emit("call:peers", peers);
  });

  socket.on("call:signal", ({ peerId, signal, room } = {}) => {
    if (typeof peerId !== "string" || !signal || typeof room !== "string") return;
    const callRoom = `${workspaceRoom}:call:${room}`;
    if (!socket.rooms.has(callRoom)) return;
    const target = io.sockets.sockets.get(peerId);
    if (!target || target.data.user.workspaceId !== user.workspaceId || !target.rooms.has(callRoom)) return;
    target.emit("call:signal", { peerId: socket.id, signal, name: user.name, room });
  });

  socket.on("call:leave", (room) => {
    if (typeof room !== "string") return;
    const callRoom = `${workspaceRoom}:call:${room}`;
    socket.to(callRoom).emit("call:peer-left", { peerId: socket.id });
    socket.leave(callRoom);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room.startsWith(`${workspaceRoom}:call:`)) {
        socket.to(room).emit("call:peer-left", { peerId: socket.id });
      }
    }
  });
});

app.set("io", io);

httpServer.listen(config.port, () => {
  console.log(`DevSphere API listening on http://localhost:${config.port}`);
});

function shutdown() {
  httpServer.close(() => {
    io.close();
    closeDatabase().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
