// src/models/index.ts
// ============================================================
// Ponto central de exportação de todos os Models.
//
// Por que centralizar as associations aqui?
//   Se cada model definisse suas próprias associations, teríamos
//   imports circulares inevitáveis (A importa B que importa A).
//   Centralizando no index.ts, todos os models são importados
//   primeiro e depois as relações são estabelecidas entre eles.
//
// Ordem de importação respeita dependências:
//   Independentes → Dependentes
// ============================================================

// ── Exportações de Models ────────────────────────────────────
export { SystemUser } from './SystemUser';
export type { UserRole } from './SystemUser';

export { Student } from './Student';
export type { Gender } from './Student';

export { StudentHealthRecord } from './StudentHealthRecord';
export type { ChronicCondition, BloodType } from './StudentHealthRecord';

export { StudentAllergy } from './Studentallergy';
export type { AllergySeverity } from './Studentallergy';

export { Medication } from './Medication';

export { MedicationBatch } from './MedicationBatch';

export { Attendance } from './Attendance';
export type { AttendanceStatus } from './Attendance';

export { Dispensation } from './Dispensation';

export { AuditLog } from './AuditLog';
export type { AuditAction, AuditPayload } from './AuditLog';

// ── Importações internas para setup das associations ─────────
import { SystemUser } from './SystemUser';
import { Student } from './Student';
import { StudentHealthRecord } from './StudentHealthRecord';
import { StudentAllergy } from './Studentallergy';
import { Medication } from './Medication';
import { MedicationBatch } from './MedicationBatch';
import { Attendance } from './Attendance';
import { Dispensation } from './Dispensation';
import { AuditLog } from './AuditLog';

// ============================================================
// ASSOCIATIONS
// Regra: sempre definir os dois lados da relação
//   belongsTo  → adiciona FK e método getX na tabela filha
//   hasMany    → adiciona método getXs na tabela pai
//   hasOne     → adiciona método getX na tabela pai (1:1)
// ============================================================

// ── Student ↔ StudentHealthRecord (1:1) ─────────────────────
Student.hasOne(StudentHealthRecord, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'healthRecord',
  onDelete: 'RESTRICT', // Não permite deletar aluno com prontuário
});
StudentHealthRecord.belongsTo(Student, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'student',
});

// ── Student ↔ StudentAllergy (1:N) ──────────────────────────
Student.hasMany(StudentAllergy, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'allergies',
  onDelete: 'RESTRICT',
});
StudentAllergy.belongsTo(Student, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'student',
});

// ── SystemUser → StudentAllergy (quem cadastrou a alergia) ───
SystemUser.hasMany(StudentAllergy, {
  foreignKey: { name: 'createdBy', allowNull: false },
  as: 'allergiesCreated',
});
StudentAllergy.belongsTo(SystemUser, {
  foreignKey: { name: 'createdBy', allowNull: false },
  as: 'createdByUser',
});

// ── Medication ↔ MedicationBatch (1:N) ──────────────────────
Medication.hasMany(MedicationBatch, {
  foreignKey: { name: 'medicationId', allowNull: false },
  as: 'batches',
  onDelete: 'RESTRICT',
});
MedicationBatch.belongsTo(Medication, {
  foreignKey: { name: 'medicationId', allowNull: false },
  as: 'medication',
});

// ── SystemUser → MedicationBatch (quem recebeu o lote) ───────
SystemUser.hasMany(MedicationBatch, {
  foreignKey: { name: 'receivedBy', allowNull: false },
  as: 'batchesReceived',
});
MedicationBatch.belongsTo(SystemUser, {
  foreignKey: { name: 'receivedBy', allowNull: false },
  as: 'receivedByUser',
});

// ── Student ↔ Attendance (1:N) ───────────────────────────────
Student.hasMany(Attendance, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'attendances',
  onDelete: 'RESTRICT',
});
Attendance.belongsTo(Student, {
  foreignKey: { name: 'studentId', allowNull: false },
  as: 'student',
});

// ── SystemUser → Attendance (profissional que atendeu) ───────
SystemUser.hasMany(Attendance, {
  foreignKey: { name: 'attendedBy', allowNull: false },
  as: 'attendancesGiven',
});
Attendance.belongsTo(SystemUser, {
  foreignKey: { name: 'attendedBy', allowNull: false },
  as: 'attendedByUser',
});

// ── Attendance ↔ Dispensation (1:N) ─────────────────────────
Attendance.hasMany(Dispensation, {
  foreignKey: { name: 'attendanceId', allowNull: false },
  as: 'dispensations',
  onDelete: 'RESTRICT',
});
Dispensation.belongsTo(Attendance, {
  foreignKey: { name: 'attendanceId', allowNull: false },
  as: 'attendance',
});

// ── MedicationBatch → Dispensation (1:N) ────────────────────
MedicationBatch.hasMany(Dispensation, {
  foreignKey: { name: 'batchId', allowNull: false },
  as: 'dispensations',
  onDelete: 'RESTRICT',
});
Dispensation.belongsTo(MedicationBatch, {
  foreignKey: { name: 'batchId', allowNull: false },
  as: 'batch',
});

// ── SystemUser → Dispensation (quem dispensou) ───────────────
SystemUser.hasMany(Dispensation, {
  foreignKey: { name: 'dispensedBy', allowNull: false },
  as: 'dispensationsGiven',
});
Dispensation.belongsTo(SystemUser, {
  foreignKey: { name: 'dispensedBy', allowNull: false },
  as: 'dispensedByUser',
});

// ── SystemUser → AuditLog (quem gerou o log) ─────────────────
SystemUser.hasMany(AuditLog, {
  foreignKey: { name: 'performedBy', allowNull: false },
  as: 'auditLogs',
});
AuditLog.belongsTo(SystemUser, {
  foreignKey: { name: 'performedBy', allowNull: false },
  as: 'performedByUser',
});

// ── Objeto de conveniência com todos os models ───────────────
export const models = {
  SystemUser,
  Student,
  StudentHealthRecord,
  StudentAllergy,
  Medication,
  MedicationBatch,
  Attendance,
  Dispensation,
  AuditLog,
} as const;

export type Models = typeof models;