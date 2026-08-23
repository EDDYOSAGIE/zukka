import type { Server } from "socket.io";

export let io: Server;

export function setRealtimeServer(server: Server): void {
  io = server;
}
