import { DataTypes } from 'sequelize';

/**
 * Modelos Sequelize — SQLite hoje; troque o dialect em db/index.js para migrar
 * (postgres, mysql, etc.) sem reescrever a camada de domínio.
 */
export function defineModels(sequelize) {
  const Match = sequelize.define(
    'Match',
    {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
      },
      result: {
        type: DataTypes.STRING(16),
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      winnerPlayerId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      winnerCharacterId: {
        type: DataTypes.STRING(36),
        allowNull: true,
      },
      winnerName: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      round: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxRounds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      matchTime: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      pvpEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'matches',
      indexes: [{ fields: ['endedAt'] }, { fields: ['winnerCharacterId'] }],
    }
  );

  const MatchPlayer = sequelize.define(
    'MatchPlayer',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      matchId: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      characterId: {
        type: DataTypes.STRING(36),
        allowNull: true,
      },
      playerId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      isBot: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      wizardType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'crimson',
      },
      color: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0xff5555,
      },
      skin: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'classic',
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      kills: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      deaths: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      monsterKills: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      loot: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      gold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      damageDealt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: 'match_players',
      indexes: [
        { fields: ['characterId'] },
        { fields: ['matchId'] },
        { fields: ['isBot', 'wizardType'] },
        { fields: ['damageDealt'] },
        { fields: ['kills'] },
        { fields: ['deaths'] },
        { fields: ['score'] },
      ],
    }
  );

  const MatchEvent = sequelize.define(
    'MatchEvent',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      matchId: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      seq: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      payloadJson: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '{}',
      },
      at: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'match_events',
      updatedAt: false,
      indexes: [{ fields: ['matchId', 'seq'] }],
    }
  );

  const MatchChatMessage = sequelize.define(
    'MatchChatMessage',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      matchId: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      characterId: {
        type: DataTypes.STRING(36),
        allowNull: true,
      },
      playerId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
      text: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      at: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'match_chat_messages',
      updatedAt: false,
      indexes: [{ fields: ['matchId'] }, { fields: ['characterId'] }],
    }
  );

  Match.hasMany(MatchPlayer, { foreignKey: 'matchId', as: 'players', onDelete: 'CASCADE' });
  MatchPlayer.belongsTo(Match, { foreignKey: 'matchId', as: 'match' });

  Match.hasMany(MatchEvent, { foreignKey: 'matchId', as: 'events', onDelete: 'CASCADE' });
  MatchEvent.belongsTo(Match, { foreignKey: 'matchId', as: 'match' });

  Match.hasMany(MatchChatMessage, {
    foreignKey: 'matchId',
    as: 'chatMessages',
    onDelete: 'CASCADE',
  });
  MatchChatMessage.belongsTo(Match, { foreignKey: 'matchId', as: 'match' });

  return { Match, MatchPlayer, MatchEvent, MatchChatMessage };
}
