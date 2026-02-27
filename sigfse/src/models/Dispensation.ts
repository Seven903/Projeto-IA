// src/models/Dispensation.ts
// ============================================================
// Model: Dispensation
// Registro de um medicamento dispensado em um atendimento.
//
// Regras de negócio:
//   • Só é criado APÓS o cross-check de alergia ser aprovado pelo AllergyCheckService
//   • allergyCheckPassed = true sempre (false indica override com justificativa — raro)
//   • A criação decrementa quantityAvailable no MedicationBatch correspondente
//   • Toda criação gera um AuditLog com action = 'DISPENSE_SUCCESS'
//
// Relações:
//   Attendance      1 → N  Dispensation
//   MedicationBatch 1 → N  Dispensation
//   SystemUser      1 → N  Dispensation (quem dispensou)
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
import { sequelize } from '../database/conection';

export class Dispensation extends Model<
  InferAttributes<Dispensation>,
  InferCreationAttributes<Dispensation>
> {
  declare id: CreationOptional<string>;

  /** FK attendances — atendimento ao qual esta dispensação pertence */
  declare attendanceId: string;

  /** FK medication_batches — lote específico de onde o medicamento foi retirado */
  declare batchId: string;

  /** FK system_users — profissional que realizou a dispensação */
  declare dispensedBy: string;

  declare dispensedAt: CreationOptional<Date>;

  /** Quantidade de unidades dispensadas (comprimidos, mL, etc.) */
  declare quantityDispensed: number;

  /**
   * Instruções de posologia registradas pelo profissional.
   * Ex: "1 comprimido a cada 8 horas por 3 dias. Tomar com alimento."
   */
  declare dosageInstructions: string;

  /**
   * Confirma que o AllergyCheckService executou o cross-check antes da dispensação.
   * Jamais deve ser false em operação normal — um false indica override documentado.
   */
  declare allergyCheckPassed: CreationOptional<boolean>;

  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getAttendance: BelongsToGetAssociationMixin<any>;
  declare getBatch: BelongsToGetAssociationMixin<any>;
  declare getDispensedByUser: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    attendance: Association<Dispensation, any>;
    batch: Association<Dispensation, any>;
    dispensedByUser: Association<Dispensation, any>;
  };
}

Dispensation.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    attendanceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'attendances', key: 'id' },
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'medication_batches', key: 'id' },
    },
    dispensedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'system_users', key: 'id' },
    },
    dispensedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    quantityDispensed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: 'Quantidade dispensada deve ser pelo menos 1.' },
        max: { args: [100], msg: 'Quantidade dispensada não pode exceder 100 unidades por dispensação.' },
      },
    },
    dosageInstructions: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Instruções de posologia são obrigatórias.' },
        len: { args: [5, 1000], msg: 'Posologia deve ter entre 5 e 1000 caracteres.' },
      },
    },
    allergyCheckPassed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'dispensations',
    modelName: 'Dispensation',
    indexes: [
      { fields: ['attendance_id'] },
      { fields: ['batch_id'] },
      { fields: ['dispensed_by'] },
      { fields: ['dispensed_at'] },
    ],
  }
);