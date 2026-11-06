import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "../api/http.js";

export function useRealtime(enabled = true) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !getToken()) return undefined;
    const endpoint = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const connection = io(endpoint, {
      auth: { token: getToken() },
      reconnection: true,
      reconnectionAttempts: 6,
      timeout: 8000,
    });
    connection.on("connect", () => {
      setSocket(connection);
      setConnected(true);
    });
    connection.on("disconnect", () => setConnected(false));
    connection.on("connect_error", (error) => {
      setConnected(false);
      console.error("DevSphere realtime connection failed:", error.message);
    });
    return () => {
      connection.disconnect();
    };
  }, [enabled]);

  return { socket, connected };
}
