import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize } from 'sequelize';
import { defineModels } from './models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSqlitePath = path.join(__dirname, '../../data/wizard_arena.sqlite');

const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

function resolveSqliteStorage() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw || raw === 'sqlite' || raw.startsWith('sqlite:')) {
    const stripped = raw.replace(/^sqlite:/, '');
    if (!stripped || stripped === 'sqlite') return defaultSqlitePath;
    return path.isAbsolute(stripped) ? stripped : path.resolve(process.cwd(), stripped);
  }
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function buildSequelize() {
  if (dialect === 'postgres' || dialect === 'postgresql') {
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
    });
  }
  if (dialect === 'mysql') {
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: 'mysql',
      logging: false,
    });
  }

  const storage = resolveSqliteStorage();
  return new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false,
  });
}

export const sequelize = buildSequelize();
export const models = defineModels(sequelize);

let ready = null;

/** Garante schema criado (sync). Em produção com Postgres, prefira migrations. */
export function initDatabase() {
  if (ready) return ready;
  ready = (async () => {
    if (dialect === 'sqlite') {
      const { mkdir } = await import('fs/promises');
      const storage = resolveSqliteStorage();
      await mkdir(path.dirname(storage), { recursive: true });
    }
    await sequelize.authenticate();
    await sequelize.sync();
    console.log(`[db] connected (${dialect})`);
    return models;
  })();
  return ready;
}

export default models;
