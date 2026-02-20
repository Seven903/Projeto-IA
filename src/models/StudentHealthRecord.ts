// src/models/StudentHealthRecord.ts
// ============================================================
// Model: StudentHealthRecord
// Prontuário Eletrônico do Estudante (PEE).
//
// Armazena dados clínicos não-alérgicos:
//   • Tipo sanguíneo
//   • Condições crônicas (Asma, Diabetes, Epilepsia, etc.)
//   • Observações gerais do enfermeiro
//
// Condições crônicas em JSONB (array de objetos):
//   Permite flexibilidade clínica sem necessidade de schema rígido.
//   Cada condição segue a interface ChronicCondition.
//
// Relação com Student: 1:1 obrigatório
//   Todo estudante deve ter um prontuário criado junto com o cadastro.
//
// Acesso restrito:
//   Apenas roles nurse, pharmacist e superadmin podem consultar.
//   A verificação ocorre no middleware RBAC antes do controller.
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  BelongsToGetAssociationMixin,
  Association,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../database/connection';

// ── Interfaces de tipos ──────────────────────────────────────

export interface ChronicCondition {
  /** Nome da condição clínica — Ex: "Asma Leve Intermitente" */
  condition: string;
  /** Código CID-10 opcional — Ex: "J45.0" */
  cid10?: string;
  /** Observações clínicas e instruções específicas */
  notes?: string;
  /** Data do diagnóstico no formato YYYY-MM-DD */
  diagnosedAt?: string;
}

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export class StudentHealthRecord extends Model<
  InferAttributes<StudentHealthRecord>,
  InferCreationAttributes<StudentHealthRecord>
> {
  declare id: CreationOptional<string>;
  declare studentId: string;

  /**
   * Lista de condições crônicas do estudante.
   * Armazenada como JSON no SQLite.
   * Ex: [{ condition: "Asma", cid10: "J45.0", notes: "Usa Salbutamol" }]
   */
  declare chronicConditions: CreationOptional<ChronicCondition[]>;

  /** Observações gerais registradas pelo enfermeiro */
  declare generalNotes: CreationOptional<string | null>;

  /** Tipo sanguíneo — Ex: "O+", "AB-" */
  declare bloodType: CreationOptional<BloodType | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getStudent: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    student: Association<StudentHealthRecord, any>;
  };

  // ── Métodos utilitários ──────────────────────────────────────

  /** Retorna true se o estudante possui pelo menos uma condição crônica */
  get hasChronicConditions(): boolean {
    return Array.isArray(this.chronicConditions) && this.chronicConditions.length > 0;
  }

  /**
   * Adiciona uma nova condição crônica à lista existente.
   * Não persiste — chamar save() após este método.
   */
  addChronicCondition(condition: ChronicCondition): void {
    const current = this.chronicConditions ?? [];
    this.chronicConditions = [...current, condition];
  }

  /**
   * Remove uma condição crônica pelo nome.
   * Não persiste — chamar save() após este método.
   */
  removeChronicCondition(conditionName: string): void {
    const current = this.chronicConditions ?? [];
    this.chronicConditions = current.filter(
      (c) => c.condition.toLowerCase() !== conditionName.toLowerCase()
    );
  }
}

StudentHealthRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: {
        name: 'uq_health_record_student_id',
        msg: 'Este estudante já possui um prontuário cadastrado.',
      },
      references: { model: 'students', key: 'id' },
    },
    chronicConditions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    generalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bloodType: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        isIn: {
          args: [['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null]],
          msg: 'Tipo sanguíneo inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O-.',
        },
      },
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'student_health_records',
    modelName: 'StudentHealthRecord',
    indexes: [
      { fields: ['student_id'], unique: true },
    ],
  }
);