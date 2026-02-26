// src/server.ts
// ============================================================
// Entrypoint do processo Node.js.
//
// Sequência de inicialização:
//   1. Carrega variáveis de ambiente (.env)
//   2. Importa todos os models (registra associations)
//   3. Testa a conexão com o SQLite
//   4. Sincroniza o schema (apenas em desenvolvimento)
//   5. Sobe o servidor HTTP
//   6. Registra handlers de shutdown gracioso
// ============================================================

import 'dotenv/config';
import * as http from 'http';
import { createApp } from './app';
import { testConnection } from './database/conection';

// Importa o index dos models para registrar todas as associations
import './models/index';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function bootstrap(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   SIGFSE — Sistema de Gestão         ║');
  console.log('║   de Farmácia e Saúde Escolar        ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ── 1. Testa conexão com o banco ────────────────────────
  await testConnection();

  // ── 2. Cria a aplicação Express ─────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  // ── 3. Sobe o servidor ───────────────────────────────────
  server.listen(PORT, HOST, () => {
    console.log(`\n✅ Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`📋 Health-check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV ?? 'development'}\n`);
  });

  // ── 4. Shutdown gracioso ─────────────────────────────────
  // Garante que conexões ativas sejam finalizadas antes de encerrar.
  // Importante para ambientes Docker e PM2.

  const shutdown = (signal: string) => {
    console.log(`\n⚠️  Sinal ${signal} recebido. Encerrando servidor...`);
    server.close(async () => {
      console.log('✅ Servidor HTTP encerrado.');
      const { sequelize } = await import('./database/conection');
      await sequelize.close();
      console.log('✅ Conexão com o banco encerrada.');
      process.exit(0);
    });

    // Força encerramento após 10s se não conseguir fechar graciosamente
    setTimeout(() => {
      console.error('❌ Forçando encerramento após timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Captura exceções não tratadas — evita crash silencioso
  process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[UncaughtException]', error);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Falha na inicialização do servidor:', err);
  process.exit(1);
});