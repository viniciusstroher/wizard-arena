import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}
