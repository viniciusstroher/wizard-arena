import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ViteExpress from 'vite-express';
import { Match } from './Match.js';
import { CONFIG } from './config.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

/** @type {Map<string, Match>} */
const matches = new Map();
/** @type {Match | null} */
let openLobby = null;

function getOrCreateLobby() {
  if (openLobby && openLobby.phase === 'lobby' && openLobby.players.size < CONFIG.MAX_PLAYERS) {
    return openLobby;
  }
  const id = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const match = new Match(id, io);
  matches.set(id, match);
  openLobby = match;
  return match;
}

function findMatchBySocket(socketId) {
  for (const match of matches.values()) {
    if (match.players.has(socketId)) return match;
  }
  return null;
}

io.on('connection', (socket) => {
  socket.emit('connected', { id: socket.id });

  socket.on('join_lobby', (payload = {}) => {
    const existing = findMatchBySocket(socket.id);
    if (existing) {
      if (existing.phase === 'lobby') {
        socket.emit('lobby_state', existing.lobbySnapshot());
        socket.emit('joined', { matchId: existing.id, playerId: socket.id });
        return;
      }
      // Sai de partida encerrada / em andamento para entrar em novo lobby
      existing.removePlayer(socket.id);
      socket.leave(existing.id);
      if (existing.players.size === 0) {
        existing.destroy();
        matches.delete(existing.id);
        if (openLobby === existing) openLobby = null;
      }
    }
    const match = getOrCreateLobby();
    const result = match.addPlayer(socket, payload.name);
    if (!result.ok) {
      socket.emit('error_msg', { message: result.error });
      return;
    }
    socket.data.matchId = match.id;
    socket.emit('joined', { matchId: match.id, playerId: socket.id });
    socket.emit('lobby_state', match.lobbySnapshot());

    if (match.phase !== 'lobby') {
      openLobby = null;
    }
  });

  socket.on('set_ready', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.setReady(socket.id, payload.ready);
    if (match.phase !== 'lobby' && openLobby === match) {
      openLobby = null;
    }
  });

  socket.on('add_bots', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    const count = Math.min(3, Math.max(1, Number(payload.count) || 1));
    match.addBots(count);
    if (match.phase !== 'lobby' && openLobby === match) {
      openLobby = null;
    }
  });

  socket.on('player_input', (input) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.setInput(socket.id, input || {});
  });

  socket.on('request_state', () => {
    const match = findMatchBySocket(socket.id);
    if (!match || match.phase === 'lobby') return;
    socket.emit('game_state', match.stateSnapshot());
  });

  socket.on('choose_spell', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.chooseSpell(socket.id, payload.index);
  });

  socket.on('leave_lobby', () => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.removePlayer(socket.id);
    if (openLobby === match && match.players.size === 0) openLobby = null;
    socket.leave(match.id);
  });

  socket.on('disconnect', () => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.removePlayer(socket.id);
    if (openLobby === match && (match.players.size === 0 || match.phase !== 'lobby')) {
      if (match.players.size === 0) openLobby = null;
    }
    if (match.phase === 'ended' || match.players.size === 0) {
      matches.delete(match.id);
    }
  });
});

// Cleanup dead matches
setInterval(() => {
  for (const [id, match] of matches) {
    if (match.phase === 'ended' || match.players.size === 0) {
      match.destroy();
      matches.delete(id);
      if (openLobby === match) openLobby = null;
    }
  }
}, 15000);

const PORT = process.env.PORT || 3080;

ViteExpress.config({
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
});

ViteExpress.bind(app, httpServer, () => {
  httpServer.listen(PORT, () => {
    console.log(`Wizard Arena running at http://localhost:${PORT}`);
  });
});
