/**
 * Socket.IO client — connects with JWT auth, provides typed event emitter.
 * Call initSocket() after login; destroySocket() after logout.
 */
import { io, type Socket } from "socket.io-client";
import type { Notification, Message } from "./types";

type ServerEvents = {
  "notification:new": (n: Notification) => void;
  "message:new": (m: Message) => void;
};

let socket: Socket | null = null;

export function initSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(typeof window !== "undefined" ? window.location.origin.replace("5173", "4000") : "http://localhost:4000", {
    auth: { token: accessToken },
    transports: ["websocket"],
  });

  socket.on("connect_error", (err) => {
    console.warn("[socket] connection error:", err.message);
  });

  return socket;
}

export function destroySocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function onSocketEvent<K extends keyof ServerEvents>(
  event: K,
  handler: ServerEvents[K],
): () => void {
  socket?.on(event as string, handler as (...args: unknown[]) => void);
  return () => socket?.off(event as string, handler as (...args: unknown[]) => void);
}
