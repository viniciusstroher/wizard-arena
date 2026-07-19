import express from 'express';
import { getCharacterMatchHistory, getLeaderboard } from './db/matchStore.js';
import { WIZARD_ELEMENTS } from './elements.js';

export function createApiRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/elements', (_req, res) => {
    res.json({ elements: WIZARD_ELEMENTS });
  });

  router.get('/characters/:characterId/matches', async (req, res) => {
    try {
      const data = await getCharacterMatchHistory(req.params.characterId, {
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json(data);
    } catch (err) {
      console.error('[api] match history', err);
      res.status(500).json({ error: 'Falha ao carregar histórico.' });
    }
  });

  router.get('/leaderboard', async (req, res) => {
    try {
      const data = await getLeaderboard({
        element: req.query.element,
        limit: req.query.limit,
      });
      res.json(data);
    } catch (err) {
      console.error('[api] leaderboard', err);
      res.status(500).json({ error: 'Falha ao carregar leaderboard.' });
    }
  });

  return router;
}
