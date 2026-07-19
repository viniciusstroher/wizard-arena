import { Op, fn, col, literal } from 'sequelize';
import { initDatabase, models } from './index.js';
import { normalizeElement, WIZARD_ELEMENTS } from '../elements.js';

const SKIP_EVENT_TYPES = new Set(['damage', 'heal']);
const MAX_EVENTS = 4000;
const MAX_CHAT = 500;

/**
 * Persiste resultado completo da partida (jogadores, eventos e chat).
 * Bots entram no histórico da partida, mas não na leaderboard.
 */
export async function persistMatch(match) {
  if (!match || match._persisted) return null;
  match._persisted = true;

  await initDatabase();
  const { Match, MatchPlayer, MatchEvent, MatchChatMessage } = models;

  const winner = match.winnerId ? match.players.get(match.winnerId) : null;
  const endedAt = new Date();
  const startedAt = match.startedAt instanceof Date ? match.startedAt : endedAt;

  const players = [...match.players.values()].map((p) => ({
    matchId: match.id,
    characterId: p.isBot ? null : p.characterId || null,
    playerId: p.id,
    name: String(p.name || 'Wizard').slice(0, 32),
    isBot: !!p.isBot,
    wizardType: p.wizardType || 'crimson',
    color: (Number(p.color) || 0xff5555) >>> 0,
    skin: p.skin || 'classic',
    score: p.score || 0,
    kills: p.kills || 0,
    deaths: p.deaths || 0,
    monsterKills: p.monsterKills || 0,
    loot: p.loot || 0,
    gold: p.gold || 0,
    damageDealt: Math.round(p.damageDealt || 0),
    level: p.level || 1,
  }));

  const eventLog = Array.isArray(match.eventLog) ? match.eventLog : [];
  const events = eventLog
    .filter((e) => e && !SKIP_EVENT_TYPES.has(e.type))
    .slice(-MAX_EVENTS)
    .map((e, i) => ({
      matchId: match.id,
      seq: i,
      type: String(e.type || 'unknown').slice(0, 64),
      payloadJson: JSON.stringify(e),
      at: Number(e._at) || 0,
    }));

  const chatLog = Array.isArray(match.chatLog) ? match.chatLog : [];
  const chatMessages = chatLog.slice(-MAX_CHAT).map((c) => ({
    matchId: match.id,
    characterId: c.characterId || null,
    playerId: c.playerId,
    name: String(c.name || 'Wizard').slice(0, 32),
    text: String(c.text || '').slice(0, 120),
    at: Number(c.at) || 0,
  }));

  const transaction = await Match.sequelize.transaction();
  try {
    await Match.create(
      {
        id: match.id,
        result: match.matchResult === 'success' ? 'success' : 'fail',
        reason: match.endReason || null,
        winnerPlayerId: match.winnerId || null,
        winnerCharacterId: winner?.characterId || null,
        winnerName: winner?.name || null,
        round: match.round || 0,
        maxRounds: match.maxRoundsSaved ?? 0,
        matchTime: Number(match.matchTime) || 0,
        pvpEnabled: !!match.pvpEnabled,
        startedAt,
        endedAt,
      },
      { transaction }
    );

    if (players.length) await MatchPlayer.bulkCreate(players, { transaction });
    if (events.length) await MatchEvent.bulkCreate(events, { transaction });
    if (chatMessages.length) await MatchChatMessage.bulkCreate(chatMessages, { transaction });

    await transaction.commit();
    return match.id;
  } catch (err) {
    await transaction.rollback();
    match._persisted = false;
    throw err;
  }
}

/** Histórico de partidas de um personagem (por UUID do cliente). */
export async function getCharacterMatchHistory(characterId, { limit = 30, offset = 0 } = {}) {
  await initDatabase();
  const { Match, MatchPlayer } = models;
  const id = String(characterId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { matches: [], total: 0, wins: 0, losses: 0 };
  }

  const take = Math.min(50, Math.max(1, Number(limit) || 30));
  const skip = Math.max(0, Number(offset) || 0);

  const rows = await MatchPlayer.findAll({
    where: { characterId: id, isBot: false },
    include: [
      {
        model: Match,
        as: 'match',
        required: true,
      },
    ],
    order: [[col('match.endedAt'), 'DESC']],
    limit: take,
    offset: skip,
  });

  const total = await MatchPlayer.count({ where: { characterId: id, isBot: false } });

  // Contagem por resultado via SQL direto — mais confiável no SQLite do que
  // Model.count({ include }) (o processo Node não hot-reload; precisa reiniciar).
  const [resultCounts] = await Match.sequelize.query(
    `SELECT m.result AS result, COUNT(*) AS c
     FROM match_players AS mp
     INNER JOIN matches AS m ON m.id = mp.matchId
     WHERE mp.characterId = :id AND mp.isBot = 0
     GROUP BY m.result`,
    { replacements: { id } }
  );
  let wins = 0;
  let losses = 0;
  for (const row of resultCounts) {
    const n = Number(row.c) || 0;
    if (row.result === 'success') wins = n;
    else if (row.result === 'fail') losses = n;
  }

  const matchIds = rows.map((r) => r.matchId);
  const peers =
    matchIds.length === 0
      ? []
      : await MatchPlayer.findAll({
          where: { matchId: { [Op.in]: matchIds }, isBot: false },
          attributes: [
            'matchId',
            'name',
            'characterId',
            'score',
            'wizardType',
            'kills',
            'deaths',
          ],
        });

  const peersByMatch = new Map();
  for (const p of peers) {
    const list = peersByMatch.get(p.matchId) || [];
    list.push({
      name: p.name,
      characterId: p.characterId,
      score: p.score,
      wizardType: p.wizardType,
      kills: p.kills,
      deaths: p.deaths,
    });
    peersByMatch.set(p.matchId, list);
  }

  return {
    matches: rows.map((row) => {
      const m = row.match;
      return {
        matchId: m.id,
        result: m.result,
        reason: m.reason,
        endedAt: m.endedAt,
        startedAt: m.startedAt,
        round: m.round,
        matchTime: m.matchTime,
        winnerName: m.winnerName,
        points: row.score,
        kills: row.kills,
        deaths: row.deaths,
        damageDealt: row.damageDealt,
        wizardType: row.wizardType,
        participants: peersByMatch.get(m.id) || [],
      };
    }),
    total,
    wins,
    losses,
  };
}

const LEADERBOARD_METRICS = {
  damage: 'damageDealt',
  damageDealt: 'damageDealt',
  kills: 'kills',
  deaths: 'deaths',
  score: 'score',
  points: 'score',
};

/**
 * Ranking agregado por personagem (somente humanos).
 * Filtra por elemento (wizardType) quando informado.
 */
export async function getLeaderboard({ element = null, limit = 15 } = {}) {
  await initDatabase();
  const { MatchPlayer } = models;
  const take = Math.min(50, Math.max(5, Number(limit) || 15));
  const wizardType = normalizeElement(element);

  const where = {
    isBot: false,
    characterId: { [Op.ne]: null },
  };
  if (wizardType) where.wizardType = wizardType;

  async function topBy(field) {
    const rows = await MatchPlayer.findAll({
      attributes: [
        'characterId',
        [fn('MAX', col('name')), 'name'],
        [fn('MAX', col('wizardType')), 'wizardType'],
        [fn('SUM', col(field)), 'total'],
        [fn('COUNT', col('id')), 'matches'],
      ],
      where,
      group: ['characterId'],
      order: [[literal('total'), 'DESC']],
      limit: take,
      raw: true,
    });
    return rows.map((r, i) => ({
      rank: i + 1,
      characterId: r.characterId,
      name: r.name,
      wizardType: r.wizardType,
      element: r.wizardType,
      value: Number(r.total) || 0,
      matches: Number(r.matches) || 0,
    }));
  }

  const [damage, kills, deaths, points] = await Promise.all([
    topBy('damageDealt'),
    topBy('kills'),
    topBy('deaths'),
    topBy('score'),
  ]);

  return {
    elements: WIZARD_ELEMENTS,
    filter: wizardType,
    damage,
    kills,
    deaths,
    points,
  };
}

export { LEADERBOARD_METRICS };
