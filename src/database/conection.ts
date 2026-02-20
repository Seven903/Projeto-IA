// src/database/connection.ts
// ============================================================
// Conexão central do Sequelize com SQLite.
//
// Responsabilidades:
//   • Criar e exportar a instância única do Sequelize (singleton)
//   • Aplicar PRAGMAs críticos em toda nova conexão via hook
//   • Expor função testConnection() para health-check na inicialização
//
// PRAGMAs aplicados:
//   - journal_mode = WAL    → permite leituras concorrentes sem lock
//   - foreign_keys  = ON    → SQLite ignora FKs por padrão; este pragma ativa
//   - synchronous   = NORMAL → equilíbrio entre segurança e performance
//   - temp_store     = MEMORY → tabelas temporárias em RAM
//   - cache_size     = -16000 → 16 MB de cache de páginas
// ============================================================

import { Sequelize, Options } from 'sequelize';
import path from 'path';

// Caminho do arquivo .db — configurável via variável de ambiente
const DB_PATH =
  process.env.DB_PATH ??
  path.resolve(__dirname, '..', '..', 'data', 'sigfse.db');

const isDevelopment = process.env.NODE_ENV === 'development';

const sequelizeOptions: Options = {
  dialect: 'sqlite',
  storage: DB_PATH,

  // Log de SQL apenas em desenvolvimento
  logging: isDevelopment
    ? (sql: string) => console.log(`\x1b[90m[SQL] ${sql}\x1b[0m`)
    : false,

  define: {
    // snake_case no banco, camelCase no código TypeScript
    underscored: true,
    // Todas as tabelas terão created_at e updated_at automaticamente
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    // Não pluraliza nomes de tabela (usamos tableName explícito em cada model)
    freezeTableName: true,
  },

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

// Instância singleton — importada por todos os models
export const sequelize = new Sequelize(sequelizeOptions);

// ── PRAGMAs aplicados após cada nova conexão ─────────────────
// O SQLite não persiste pragmas de sessão entre conexões,
// por isso precisamos reaplicá-los via hook afterConnect.
sequelize.addHook('afterConnect', async (connection: unknown) => {
  const conn = connection as { run: (sql: string) => Promise<void> };
  await conn.run('PRAGMA journal_mode = WAL;');
  await conn.run('PRAGMA foreign_keys = ON;');
  await conn.run('PRAGMA synchronous = NORMAL;');
  await conn.run('PRAGMA temp_store = MEMORY;');
  await conn.run('PRAGMA cache_size = -16000;');
});

// ── Health-check de conexão ──────────────────────────────────
export async function testConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com SQLite estabelecida com sucesso.');
    console.log(`📁 Banco de dados: ${DB_PATH}`);
  } catch (error) {
    console.error('❌ Falha ao conectar com o banco de dados:', error);
    throw error;
  }
}