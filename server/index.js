import express from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import ViteExpress from 'vite-express';
import { Match } from './Match.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

/** @type {Map<string, Match>} */
const matches = new Map();

const LOBBY_BROWSER = 'lobby_browser';

function clampMaxPlayers(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 4;
  return Math.min(8, Math.max(1, v));
}

function normalizePassword(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!/^\d{4}$/.test(s)) return undefined; // inválida
  return s;
}

function findMatchBySocket(socketId) {
  for (const match of matches.values()) {
    if (match.players.has(socketId)) return match;
  }
  return null;
}

function lobbyListItem(match) {
  const humans = [...match.players.values()].filter((p) => !p.isBot);
  const host = humans[0] || [...match.players.values()][0];
  return {
    id: match.id,
    playerCount: match.players.size,
    maxPlayers: match.maxPlayers,
    hasPassword: Boolean(match.password),
    hostName: host?.name || 'Wizard',
    phase: match.phase,
  };
}

function listOpenLobbies() {
  return [...matches.values()]
    .filter((m) => m.phase === 'lobby' && m.players.size > 0)
    .map(lobbyListItem);
}

function broadcastLobbies() {
  io.to(LOBBY_BROWSER).emit('lobbies_list', { lobbies: listOpenLobbies() });
}

function destroyMatch(match) {
  if (!match) return;
  match.destroy();
  matches.delete(match.id);
  broadcastLobbies();
}

function leaveCurrentMatch(socket) {
  const existing = findMatchBySocket(socket.id);
  if (!existing) return;
  existing.removePlayer(socket.id);
  socket.leave(existing.id);
  if (existing.players.size === 0 || existing.phase === 'ended') {
    destroyMatch(existing);
  } else {
    broadcastLobbies();
  }
}

const WIZARD_SKIN_IDS = new Set([
  'classic',
  'hooded',
  'crowned',
  'battle',
  'mystic',
  'shadow',
]);

function normalizeSkin(skin) {
  const id = String(skin || 'classic');
  return WIZARD_SKIN_IDS.has(id) ? id : 'classic';
}

function appearanceFromPayload(payload = {}) {
  const color = Number(payload.color);
  return {
    name: payload.name,
    color: Number.isFinite(color) ? color >>> 0 : undefined,
    skin: normalizeSkin(payload.skin),
  };
}

io.on('connection', (socket) => {
  socket.emit('connected', { id: socket.id });

  socket.on('subscribe_lobbies', () => {
    socket.join(LOBBY_BROWSER);
    socket.emit('lobbies_list', { lobbies: listOpenLobbies() });
  });

  socket.on('unsubscribe_lobbies', () => {
    socket.leave(LOBBY_BROWSER);
  });

  socket.on('create_lobby', (payload = {}) => {
    leaveCurrentMatch(socket);

    const maxPlayers = clampMaxPlayers(payload.maxPlayers ?? 4);
    const password = normalizePassword(payload.password);
    if (password === undefined) {
      socket.emit('error_msg', { message: 'Senha inválida. Use exatamente 4 dígitos.' });
      return;
    }

    const id = randomUUID();
    const match = new Match(id, io, { maxPlayers, password });
    matches.set(id, match);

    const appearance = appearanceFromPayload(payload);
    const result = match.addPlayer(socket, appearance.name, {
      color: appearance.color,
      skin: appearance.skin,
      skipPassword: true,
    });
    if (!result.ok) {
      destroyMatch(match);
      socket.emit('error_msg', { message: result.error });
      return;
    }

    socket.data.matchId = match.id;
    socket.emit('lobby_created', { matchId: match.id, playerId: socket.id });
    socket.emit('joined', { matchId: match.id, playerId: socket.id });
    socket.emit('lobby_state', match.lobbySnapshot());
    broadcastLobbies();
  });

  socket.on('join_lobby', (payload = {}) => {
    const matchId = String(payload.matchId || '').trim();
    if (!matchId) {
      socket.emit('error_msg', { message: 'Lobby não existe.', code: 'lobby_not_found' });
      return;
    }

    const existing = findMatchBySocket(socket.id);
    if (existing && existing.id === matchId && existing.phase === 'lobby') {
      socket.emit('lobby_state', existing.lobbySnapshot());
      socket.emit('joined', { matchId: existing.id, playerId: socket.id });
      return;
    }
    if (existing) {
      leaveCurrentMatch(socket);
    }

    const match = matches.get(matchId);
    if (!match || match.phase !== 'lobby') {
      socket.emit('error_msg', { message: 'Lobby não existe.', code: 'lobby_not_found' });
      return;
    }

    const appearance = appearanceFromPayload(payload);
    const result = match.addPlayer(socket, appearance.name, {
      color: appearance.color,
      skin: appearance.skin,
      password: payload.password,
    });
    if (!result.ok) {
      socket.emit('error_msg', {
        message: result.error,
        code: result.code || 'join_failed',
      });
      return;
    }

    socket.data.matchId = match.id;
    socket.emit('joined', { matchId: match.id, playerId: socket.id });
    socket.emit('lobby_state', match.lobbySnapshot());
    broadcastLobbies();
  });

  socket.on('set_ready', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    match.setReady(socket.id, payload.ready);
    broadcastLobbies();
  });

  socket.on('add_bots', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    const count = Math.min(3, Math.max(1, Number(payload.count) || 1));
    match.addBots(count);
    broadcastLobbies();
  });

  socket.on('remove_bots', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    const count = Math.min(3, Math.max(1, Number(payload.count) || 1));
    match.removeBots(count);
    broadcastLobbies();
  });

  socket.on('admin_settings', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    const result = match.setAdminSettings(payload);
    socket.emit('admin_settings_ack', result);
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
    match.chooseSpell(socket.id, payload);
  });

  socket.on('chat_message', (payload = {}) => {
    const match = findMatchBySocket(socket.id);
    if (!match) return;
    const player = match.players.get(socket.id);
    if (!player || player.isBot) return;

    const now = Date.now();
    if (player.lastChatAt && now - player.lastChatAt < 400) return;
    const text = String(payload.text ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 100);
    if (!text) return;

    player.lastChatAt = now;
    match.broadcast({
      type: 'chat',
      playerId: socket.id,
      name: player.name,
      text,
    });
  });

  socket.on('leave_lobby', () => {
    leaveCurrentMatch(socket);
  });

  socket.on('disconnect', () => {
    leaveCurrentMatch(socket);
  });
});

// Cleanup dead matches / sockets fantasmas
setInterval(() => {
  for (const match of [...matches.values()]) {
    if (match.phase === 'lobby') {
      for (const pid of [...match.players.keys()]) {
        if (String(pid).startsWith('bot_')) continue;
        if (!io.sockets.sockets.has(pid)) {
          match.removePlayer(pid);
        }
      }
    }
    if (match.phase === 'ended' || match.players.size === 0) {
      destroyMatch(match);
    }
  }
  broadcastLobbies();
}, 15000);

const PORT = process.env.PORT || 3080;

ViteExpress.config({
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
});

// SPA fallback para rotas do cliente
app.get(['/character', '/matchmaking', '/matchmaking/*'], (req, res, next) => {
  req.url = '/';
  next();
});

ViteExpress.bind(app, httpServer, () => {
  httpServer.listen(PORT, () => {
    console.log(`Wizard Arena running at http://localhost:${PORT}`);
  });
});
