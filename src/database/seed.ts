// src/database/seed.ts
// ============================================================
// Popula o banco com dados iniciais para desenvolvimento e testes.
//
// Como usar:
//   npm run db:seed
//
// O que é criado:
//   • 3 usuários do sistema (superadmin, nurse, pharmacist)
//   • 4 medicamentos com princípio ativo normalizado
//   • 4 lotes (incluindo 1 vencido e 1 com estoque baixo para testar alertas)
//   • 3 estudantes com prontuários
//   • 3 alergias (incluindo 1 anafílática para testar o cross-check)
//   • 2 atendimentos com dispensações
//
// ATENÇÃO: Não execute em produção. Senhas são placeholders para teste.
// ============================================================

import '../models/index';
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
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed(): Promise<void> {
  try {
    await testConnection();
    console.log('\n🌱 Iniciando seed do banco de dados...\n');

    // ── 1. Usuários do sistema ──────────────────────────────────
    console.log('👤 Criando usuários...');

    const adminId = uuidv4();
    const nurseId = uuidv4();
    const pharmacistId = uuidv4();

    await SystemUser.scope('withPassword').bulkCreate(
      [
        {
          id: adminId,
          fullName: 'Administrador SIGFSE',
          email: 'admin@escola.edu.br',
          passwordHash: await bcrypt.hash('Admin@2024!', 12),
          role: 'superadmin',
          isActive: true,
        },
        {
          id: nurseId,
          fullName: 'Ana Souza',
          email: 'enfermeira.ana@escola.edu.br',
          passwordHash: await bcrypt.hash('Enfermeira@2024!', 12),
          role: 'nurse',
          councilNumber: 'COREN-SP 987654',
          isActive: true,
        },
        {
          id: pharmacistId,
          fullName: 'João Pereira',
          email: 'farmaceutico.joao@escola.edu.br',
          passwordHash: await bcrypt.hash('Farmacia@2024!', 12),
          role: 'pharmacist',
          councilNumber: 'CRF-SP 12345',
          isActive: true,
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 3 usuários criados');

    // ── 2. Medicamentos ─────────────────────────────────────────
    console.log('\n💊 Criando medicamentos...');

    const medDipiId = uuidv4();
    const medIbuId = uuidv4();
    const medBusId = uuidv4();
    const medAmoId = uuidv4();

    await Medication.bulkCreate(
      [
        {
          id: medDipiId,
          sku: 'MED-001',
          commercialName: 'Novalgina 500mg',
          activeIngredient: 'dipirona sodica', // normalizado: sem acento, minúsculas
          dosage: '500mg',
          pharmaceuticalForm: 'Comprimido',
          unitMeasure: 'comprimido',
          minimumStockQty: 20,
          isControlled: false,
          requiresPrescription: false,
        },
        {
          id: medIbuId,
          sku: 'MED-002',
          commercialName: 'Ibuprofeno EMS 400mg',
          activeIngredient: 'ibuprofeno',
          dosage: '400mg',
          pharmaceuticalForm: 'Comprimido',
          unitMeasure: 'comprimido',
          minimumStockQty: 15,
          isControlled: false,
          requiresPrescription: false,
        },
        {
          id: medBusId,
          sku: 'MED-003',
          commercialName: 'Buscopan Simples 10mg',
          activeIngredient: 'hioscina',
          dosage: '10mg',
          pharmaceuticalForm: 'Comprimido',
          unitMeasure: 'comprimido',
          minimumStockQty: 10,
          isControlled: false,
          requiresPrescription: false,
        },
        {
          id: medAmoId,
          sku: 'MED-004',
          commercialName: 'Amoxicilina 500mg',
          activeIngredient: 'amoxicilina',
          dosage: '500mg',
          pharmaceuticalForm: 'Cápsula',
          unitMeasure: 'capsula',
          minimumStockQty: 8,
          isControlled: false,
          requiresPrescription: true,
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 4 medicamentos criados');

    // ── 3. Lotes de medicamentos ────────────────────────────────
    console.log('\n📦 Criando lotes...');

    const batchDipi1Id = uuidv4();
    const batchIbuId = uuidv4();
    const batchBusId = uuidv4();
    const batchAmoId = uuidv4();

    await MedicationBatch.bulkCreate(
      [
        {
          // Lote normal — estoque ok, dentro da validade
          id: batchDipi1Id,
          medicationId: medDipiId,
          batchNumber: 'LOT-2024-001',
          manufacturer: 'Sanofi Aventis',
          quantityTotal: 200,
          quantityAvailable: 150,
          manufactureDate: new Date('2024-01-15'),
          expiryDate: new Date('2026-06-30'),
          alertDaysBeforeExpiry: 30,
          receivedBy: pharmacistId,
        },
        {
          // ⚠️ Lote vencido + estoque baixo — para testar alertas de BI
          id: batchIbuId,
          medicationId: medIbuId,
          batchNumber: 'LOT-2024-002',
          manufacturer: 'EMS Pharma',
          quantityTotal: 100,
          quantityAvailable: 8, // < minimumStockQty (15) → alerta de estoque baixo
          manufactureDate: new Date('2023-03-01'),
          expiryDate: new Date('2025-01-01'), // vencido → alerta de validade
          alertDaysBeforeExpiry: 30,
          receivedBy: pharmacistId,
        },
        {
          // Lote ok
          id: batchBusId,
          medicationId: medBusId,
          batchNumber: 'LOT-2024-003',
          manufacturer: 'Boehringer Ingelheim',
          quantityTotal: 60,
          quantityAvailable: 45,
          manufactureDate: new Date('2024-06-01'),
          expiryDate: new Date('2027-05-31'),
          alertDaysBeforeExpiry: 30,
          receivedBy: pharmacistId,
        },
        {
          // Lote vencendo em breve — para testar alerta de proximidade
          id: batchAmoId,
          medicationId: medAmoId,
          batchNumber: 'LOT-2024-004',
          manufacturer: 'Medley',
          quantityTotal: 30,
          quantityAvailable: 22,
          manufactureDate: new Date('2024-02-10'),
          expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias
          alertDaysBeforeExpiry: 30,
          receivedBy: pharmacistId,
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 4 lotes criados (1 vencido, 1 estoque baixo, 1 vencendo em 15 dias)');

    // ── 4. Estudantes ───────────────────────────────────────────
    console.log('\n🎒 Criando estudantes...');

    const student1Id = uuidv4();
    const student2Id = uuidv4();
    const student3Id = uuidv4();

    await Student.bulkCreate(
      [
        {
          id: student1Id,
          enrollmentCode: '2024001',
          fullName: 'Lucas Mendes Oliveira',
          birthDate: new Date('2008-05-12'),
          gender: 'male',
          gradeClass: '3°A-Ensino Médio',
          guardianName: 'Maria Mendes Oliveira',
          guardianPhone: '(11) 99999-0001',
          guardianEmail: 'maria.oliveira@email.com',
          guardianRelation: 'mãe',
          lgpdConsent: true,
          lgpdConsentAt: new Date('2024-02-01'),
        },
        {
          id: student2Id,
          enrollmentCode: '2024002',
          fullName: 'Beatriz Santos Lima',
          birthDate: new Date('2009-11-03'),
          gender: 'female',
          gradeClass: '2°B-Ensino Médio',
          guardianName: 'Roberto Santos Lima',
          guardianPhone: '(11) 99999-0002',
          guardianEmail: 'roberto.lima@email.com',
          guardianRelation: 'pai',
          lgpdConsent: true,
          lgpdConsentAt: new Date('2024-02-01'),
        },
        {
          id: student3Id,
          enrollmentCode: '2024003',
          fullName: 'Carlos Eduardo Ferreira',
          birthDate: new Date('2010-07-22'),
          gender: 'male',
          gradeClass: '1°C-Ensino Médio',
          guardianName: 'Sandra Ferreira',
          guardianPhone: '(11) 99999-0003',
          guardianRelation: 'mãe',
          lgpdConsent: true,
          lgpdConsentAt: new Date('2024-02-05'),
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 3 estudantes criados');

    // ── 5. Prontuários eletrônicos ──────────────────────────────
    console.log('\n📋 Criando prontuários...');

    await StudentHealthRecord.bulkCreate(
      [
        {
          id: uuidv4(),
          studentId: student1Id,
          bloodType: 'O+',
          chronicConditions: [
            {
              condition: 'Asma Leve Intermitente',
              cid10: 'J45.0',
              notes: 'Usa Salbutamol (bombinha) quando necessário. Evitar exercício intenso em dias frios.',
              diagnosedAt: '2016-03-10',
            },
          ],
          generalNotes: 'Aluno com histórico de reações alérgicas severas. Verificar alergias antes de qualquer medicação.',
        },
        {
          id: uuidv4(),
          studentId: student2Id,
          bloodType: 'A+',
          chronicConditions: [],
          generalNotes: null,
        },
        {
          id: uuidv4(),
          studentId: student3Id,
          bloodType: 'B-',
          chronicConditions: [
            {
              condition: 'Rinite Alérgica',
              cid10: 'J30.4',
              notes: 'Usa Loratadina 10mg diariamente.',
            },
          ],
          generalNotes: null,
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 3 prontuários criados');

    // ── 6. Alergias ─────────────────────────────────────────────
    console.log('\n⚠️  Criando alergias...');

    await StudentAllergy.bulkCreate(
      [
        {
          // 🚨 ALERGIA ANAFÍLÁTICA — bloqueia dispensação de Dipirona para Lucas
          id: uuidv4(),
          studentId: student1Id,
          activeIngredient: 'dipirona sodica', // mesmo valor normalizado do medicamento
          allergenName: 'Dipirona (Novalgina)',
          severity: 'anaphylactic',
          reactionDescription:
            'Anafilaxia com urticária generalizada, angioedema e dificuldade respiratória grave após uso de Novalgina aos 6 anos. Precisou de adrenalina no pronto-socorro.',
          diagnosedBy: 'Dr. Carlos Ferreira — CRM-SP 54321 (Alergologista)',
          diagnosedAt: new Date('2014-08-20'),
          createdBy: nurseId,
        },
        {
          // Alergia severa — bloqueia amoxicilina para Beatriz
          id: uuidv4(),
          studentId: student2Id,
          activeIngredient: 'amoxicilina',
          allergenName: 'Amoxicilina (Amoxil / Duo)',
          severity: 'severe',
          reactionDescription:
            'Erupção cutânea generalizada (rash maculopapular) e angioedema facial após curso de amoxicilina por amigdalite em 2019.',
          diagnosedBy: 'Dra. Paula Costa — CRM-SP 67890 (Pediatra)',
          diagnosedAt: new Date('2019-03-15'),
          createdBy: nurseId,
        },
        {
          // Alergia moderada — alerta mas não bloqueia
          id: uuidv4(),
          studentId: student3Id,
          activeIngredient: 'ibuprofeno',
          allergenName: 'Ibuprofeno (Advil / Alivium)',
          severity: 'moderate',
          reactionDescription:
            'Dor gástrica intensa e náuseas após uso de ibuprofeno. Sem reação sistêmica.',
          diagnosedBy: null,
          diagnosedAt: null,
          createdBy: nurseId,
        },
      ],
      { ignoreDuplicates: true }
    );
    console.log('  ✓ 3 alergias criadas (1 anafílática, 1 severa, 1 moderada)');

    // ── 7. Atendimentos e dispensações de exemplo ───────────────
    console.log('\n🏥 Criando atendimentos de exemplo...');

    const attendance1Id = uuidv4();
    const attendance2Id = uuidv4();

    await Attendance.bulkCreate([
      {
        id: attendance1Id,
        studentId: student3Id, // Carlos — sem alergia ao Buscopan
        attendedBy: nurseId,
        attendedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h atrás
        symptoms: 'Dor abdominal tipo cólica, sem febre.',
        clinicalNotes: 'Paciente relata dor há 1 hora. PA normal. Autorizado uso de antiespasmódico.',
        temperatureC: 36.5,
        bloodPressure: '110/70',
        status: 'dispensed',
      },
      {
        id: attendance2Id,
        studentId: student1Id, // Lucas — tentativa de dispensar Dipirona (será bloqueada)
        attendedBy: nurseId,
        attendedAt: new Date(Date.now() - 30 * 60 * 1000), // 30min atrás
        symptoms: 'Cefaleia intensa, sem febre.',
        clinicalNotes: 'Tentativa de dispensar Dipirona — BLOQUEADA por alergia anafílática.',
        temperatureC: 36.8,
        status: 'blocked_allergy',
      },
    ], { ignoreDuplicates: true });

    // Dispensação legítima para o atendimento 1 (Buscopan para Carlos)
    await Dispensation.bulkCreate([
      {
        id: uuidv4(),
        attendanceId: attendance1Id,
        batchId: batchBusId,
        dispensedBy: nurseId,
        quantityDispensed: 1,
        dosageInstructions: '1 comprimido agora. Repetir em 8 horas se necessário. Máximo 3 comprimidos/dia.',
        allergyCheckPassed: true,
        notes: 'Cross-check realizado: sem alergias ao princípio ativo hioscina.',
      },
    ], { ignoreDuplicates: true });

    // Decrementa estoque do lote de Buscopan
    await MedicationBatch.update(
      { quantityAvailable: sequelize.literal('quantity_available - 1') },
      { where: { id: batchBusId } }
    );

    console.log('  ✓ 2 atendimentos criados (1 com dispensação, 1 bloqueado por alergia)');

    // ── 8. Logs de auditoria de exemplo ────────────────────────
    console.log('\n📝 Criando logs de auditoria...');

    await AuditLog.bulkCreate([
      {
        performedBy: nurseId,
        action: 'DISPENSE_SUCCESS',
        targetTable: 'dispensations',
        targetId: attendance1Id,
        payload: {
          studentId: student3Id,
          medicationName: 'Buscopan Simples 10mg',
          activeIngredient: 'hioscina',
          quantity: 1,
          allergyCheckPassed: true,
        },
        ipAddress: '192.168.1.10',
      },
      {
        performedBy: nurseId,
        action: 'DISPENSE_BLOCKED_ALLERGY',
        targetTable: 'attendances',
        targetId: attendance2Id,
        payload: {
          studentId: student1Id,
          medicationName: 'Novalgina 500mg',
          activeIngredient: 'dipirona sodica',
          allergyId: 'ver student_allergies',
          severity: 'anaphylactic',
          reason: 'Princípio ativo dipirona sodica consta na lista de alergias anafíláticas do aluno.',
        },
        ipAddress: '192.168.1.10',
      },
    ]);
    console.log('  ✓ 2 logs de auditoria criados');

    // ── Resumo final ────────────────────────────────────────────
    console.log('\n' + '─'.repeat(55));
    console.log('🌱 Seed concluído com sucesso!\n');

    console.log('📌 Contas de acesso:');
    console.log('   admin@escola.edu.br          → Admin@2024!     (superadmin)');
    console.log('   enfermeira.ana@escola.edu.br → Enfermeira@2024! (nurse)');
    console.log('   farmaceutico.joao@escola.edu.br → Farmacia@2024! (pharmacist)\n');

    console.log('🧪 Cenários para testes:');
    console.log('   • Matrícula 2024001 (Lucas)   — alergia ANAFILÁTICA à Dipirona → BLOQUEIA');
    console.log('   • Matrícula 2024002 (Beatriz) — alergia SEVERA à Amoxicilina   → BLOQUEIA');
    console.log('   • Matrícula 2024003 (Carlos)  — alergia MODERADA ao Ibuprofeno → ALERTA\n');

    console.log('⚠️  Alertas de estoque ativos:');
    console.log('   • Ibuprofeno LOT-2024-002 — estoque baixo (8 un.) + VENCIDO');
    console.log('   • Amoxicilina LOT-2024-004 — vence em ~15 dias');
    console.log('─'.repeat(55) + '\n');

  } catch (error) {
    console.error('\n❌ Erro durante o seed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();