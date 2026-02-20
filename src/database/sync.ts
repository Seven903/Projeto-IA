// src/database/sync.ts
// ============================================================
// Cria ou atualiza as tabelas no banco SQLite.
//
// Como usar:
//   npm run db:sync              → produção segura (alter: true)
//   npm run db:sync -- --force   → DESTRÓI e recria tudo (só dev)
//
// Ordem de criação respeita as foreign keys:
//   1. system_users              (sem dependências)
//   2. students                  (sem dependências)
//   3. student_health_records    (depende de students)
//   4. student_allergies         (depende de students e system_users)
//   5. medications               (sem dependências)
//   6. medication_batches        (depende de medications e system_users)
//   7. attendances               (depende de students e system_users)
//   8. dispensations             (depende de attendances e medication_batches)
//   9. audit_logs                (depende de system_users)
//
// AVISO: Em produção real, prefira Sequelize Migrations (sequelize-cli)
// em vez de sync(), pois migrations permitem rollback controlado.
// ============================================================

import '../models/index'; // Registra todos os models e associations
import { sequelize, testConnection } from './connection';
import {
  SystemUser,
  Student,
  StudentHealthRecord,
  StudentAllergy,
  Medication,
  MedicationBatch,
  Attendance,
  Dispensation,
  AuditLog,
} from '../models/index';

// Lê flag --force dos argumentos de linha de comando
const forceSync = process.argv.includes('--force');

async function syncDatabase(): Promise<void> {
  try {
    await testConnection();

    if (forceSync) {
      console.warn('\n⚠️  MODO FORCE ATIVO — todas as tabelas serão DESTRUÍDAS e recriadas!');
      console.warn('   Aguarde 3 segundos para cancelar (Ctrl+C)...\n');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`\n🔄 Sincronizando tabelas (force=${forceSync}, alter=${!forceSync})...\n`);

    // Sincroniza na ordem correta para respeitar FKs
    // force: true → dropa e recria | alter: true → adiciona colunas novas
    const syncOptions = forceSync ? { force: true } : { alter: true };

    // Camada 1 — sem dependências
    await SystemUser.sync(syncOptions);
    console.log('  ✓ system_users');

    await Student.sync(syncOptions);
    console.log('  ✓ students');

    await Medication.sync(syncOptions);
    console.log('  ✓ medications');

    // Camada 2 — dependem da camada 1
    await StudentHealthRecord.sync(syncOptions);
    console.log('  ✓ student_health_records');

    await StudentAllergy.sync(syncOptions);
    console.log('  ✓ student_allergies');

    await MedicationBatch.sync(syncOptions);
    console.log('  ✓ medication_batches');

    await Attendance.sync(syncOptions);
    console.log('  ✓ attendances');

    // Camada 3 — dependem da camada 2
    await Dispensation.sync(syncOptions);
    console.log('  ✓ dispensations');

    await AuditLog.sync(syncOptions);
    console.log('  ✓ audit_logs');

    // Confirma tabelas criadas consultando o sqlite_master
    console.log('\n📋 Tabelas presentes no banco:');
    const [tables] = await sequelize.query(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name;`
    );
    (tables as Array<{ name: string }>).forEach((t) =>
      console.log(`     • ${t.name}`)
    );

    console.log('\n✅ Sincronização concluída com sucesso!\n');
  } catch (error) {
    console.error('\n❌ Erro durante a sincronização:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

syncDatabase();