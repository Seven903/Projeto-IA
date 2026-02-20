// src/models/StudentAllergy.ts
// ============================================================
// Model: StudentAllergy
// Matriz crítica de alergias medicamentosas do estudante.
//
// Este model é o coração da trava de segurança do sistema.
// O campo activeIngredient é NORMALIZADO (minúsculas, sem acentos)
// para garantir cross-check farmacológico sem falsos negativos.
//
// Lógica de bloqueio por severidade:
//   'anaphylactic' → BLOQUEIO ABSOLUTO, não permite override
//   'severe'       → BLOQUEIO, requer justificativa clínica documentada
//   'moderate'     → ALERTA com confirmação obrigatória do enfermeiro
//   'mild'         → AVISO informativo, não bloqueia
//
// Índice composto (student_id, active_ingredient):
//   Garante que a query de cross-check execute em O(log n),
//   tornando-a viável mesmo no caminho crítico da dispensação.
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  BelongsToGetAssociationMixin,
  Association,
  NonAttribute,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../database/connection';

// ── Tipos exportados ─────────────────────────────────────────
export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'anaphylactic';

export class StudentAllergy extends Model<
  InferAttributes<StudentAllergy>,
  InferCreationAttributes<StudentAllergy>
> {
  declare id: CreationOptional<string>;
  declare studentId: string;

  /**
   * Princípio ativo NORMALIZADO — âncora do cross-check.
   * DEVE ser inserido em minúsculas sem acentos.
   * Ex: "dipirona sodica", "ibuprofeno", "amoxicilina"
   *
   * Use StudentAllergy.normalizeIngredient() antes de persistir.
   */
  declare activeIngredient: string;

  /** Nome amigável para exibição na UI — pode conter acentos e marca */
  declare allergenName: string;

  declare severity: AllergySeverity;

  /** Descrição da reação anterior — auxilia o profissional na decisão clínica */
  declare reactionDescription: CreationOptional<string | null>;

  /** Nome do médico que diagnosticou a alergia */
  declare diagnosedBy: CreationOptional<string | null>;

  declare diagnosedAt: CreationOptional<Date | null>;

  /** FK para system_users — rastreabilidade de quem cadastrou */
  declare createdBy: string;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getStudent: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    student: Association<StudentAllergy, any>;
    createdByUser: Association<StudentAllergy, any>;
  };

  // ── Getters computados ───────────────────────────────────────

  /**
   * Retorna true se a alergia pode causar risco de vida iminente.
   * Usado pelo AllergyCheckService para determinar o tipo de bloqueio.
   */
  get isLifeThreatening(): NonAttribute<boolean> {
    return this.severity === 'anaphylactic';
  }

  /**
   * Retorna true se a alergia exige bloqueio (severa ou anafílática).
   */
  get requiresBlock(): NonAttribute<boolean> {
    return this.severity === 'anaphylactic' || this.severity === 'severe';
  }

  /**
   * Retorna true se a alergia exige apenas alerta (leve ou moderada).
   */
  get requiresWarningOnly(): NonAttribute<boolean> {
    return this.severity === 'mild' || this.severity === 'moderate';
  }

  /**
   * Retorna o label de severidade em português para exibição.
   */
  get severityLabel(): NonAttribute<string> {
    const labels: Record<AllergySeverity, string> = {
      mild: 'Leve',
      moderate: 'Moderada',
      severe: 'Severa',
      anaphylactic: 'Anafilática 🚨',
    };
    return labels[this.severity];
  }

  // ── Métodos estáticos ────────────────────────────────────────

  /**
   * Normaliza um princípio ativo para uso no cross-check.
   * Remove acentos, converte para minúsculas e elimina espaços extras.
   *
   * Exemplos:
   *   "Dipirona Sódica" → "dipirona sodica"
   *   "IBUPROFENO"      → "ibuprofeno"
   *   "Amoxicilína"     → "amoxicilina"
   */
  static normalizeIngredient(ingredient: string): string {
    return ingredient
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
      .replace(/\s+/g, ' ')           // normaliza espaços múltiplos
      .trim();
  }
}

StudentAllergy.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'students', key: 'id' },
    },
    activeIngredient: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Princípio ativo é obrigatório.' },
        isLowercase(value: string) {
          if (value !== value.toLowerCase()) {
            throw new Error('Princípio ativo deve estar em letras minúsculas (use normalizeIngredient()).');
          }
        },
      },
    },
    allergenName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome do alérgeno é obrigatório.' },
      },
    },
    severity: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['mild', 'moderate', 'severe', 'anaphylactic']],
          msg: 'Severidade inválida. Valores aceitos: mild, moderate, severe, anaphylactic.',
        },
      },
    },
    reactionDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    diagnosedBy: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    diagnosedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'system_users', key: 'id' },
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'student_allergies',
    modelName: 'StudentAllergy',
    indexes: [
      // Índice composto crítico — caminho quente do cross-check de segurança
      {
        fields: ['student_id', 'active_ingredient'],
        unique: true,
        name: 'uq_student_active_ingredient',
      },
      { fields: ['severity'] },
      { fields: ['student_id'] },
    ],
  }
);