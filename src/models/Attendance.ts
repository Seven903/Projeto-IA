// src/models/Attendance.ts
// ============================================================
// Model: Attendance
// Registro de cada atendimento na enfermaria escolar.
//
// Ciclo de vida (status):
//   open            → atendimento iniciado, aguardando ação
//   dispensed       → medicamento(s) dispensado(s) com sucesso
//   referred        → aluno encaminhado para serviço externo (UBS, hospital)
//   blocked_allergy → tentativa de dispensação bloqueada por conflito de alergia
//   closed          → atendimento encerrado sem dispensação
//
// Relações:
//   Student       1 → N  Attendance
//   SystemUser    1 → N  Attendance  (profissional que atendeu)
//   Attendance    1 → N  Dispensation
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
  Association,
  NonAttribute,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../database/connection';

export type AttendanceStatus =
  | 'open'
  | 'dispensed'
  | 'referred'
  | 'closed'
  | 'blocked_allergy';

export class Attendance extends Model<
  InferAttributes<Attendance>,
  InferCreationAttributes<Attendance>
> {
  declare id: CreationOptional<string>;
  declare studentId: string;
  /** FK system_users — profissional de saúde que realizou o atendimento */
  declare attendedBy: string;
  declare attendedAt: CreationOptional<Date>;

  /** Descrição dos sintomas relatados pelo aluno — obrigatório */
  declare symptoms: string;

  /** Observações clínicas e decisões do profissional */
  declare clinicalNotes: CreationOptional<string | null>;

  /** Temperatura em graus Celsius — Ex: 37.2 */
  declare temperatureC: CreationOptional<number | null>;

  /** Pressão arterial — Ex: "120/80" */
  declare bloodPressure: CreationOptional<string | null>;

  declare status: CreationOptional<AttendanceStatus>;

  /** Destino do encaminhamento quando status = 'referred' — Ex: "UBS Vila Nova" */
  declare referralDestination: CreationOptional<string | null>;

  declare closedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getStudent: BelongsToGetAssociationMixin<any>;
  declare getAttendedByUser: BelongsToGetAssociationMixin<any>;
  declare getDispensations: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    student: Association<Attendance, any>;
    attendedByUser: Association<Attendance, any>;
    dispensations: Association<Attendance, any>;
  };

  // ── Getters computados ───────────────────────────────────────

  /** Retorna true se o atendimento ainda está em aberto */
  get isOpen(): NonAttribute<boolean> {
    return this.status === 'open';
  }

  /** Retorna true se o atendimento foi encerrado por qualquer motivo */
  get isClosed(): NonAttribute<boolean> {
    return this.status !== 'open';
  }

  /** Retorna o tempo de atendimento em minutos (desde abertura até agora ou fechamento) */
  get durationMinutes(): NonAttribute<number> {
    const start = new Date(this.attendedAt ?? this.createdAt!);
    const end = this.closedAt ? new Date(this.closedAt) : new Date();
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  /** Retorna label legível do status para exibição na UI */
  get statusLabel(): NonAttribute<string> {
    const labels: Record<AttendanceStatus, string> = {
      open: 'Em Atendimento',
      dispensed: 'Medicado',
      referred: 'Encaminhado',
      closed: 'Encerrado',
      blocked_allergy: '⚠️ Bloqueado — Alergia',
    };
    return labels[this.status ?? 'open'];
  }
}

Attendance.init(
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
    attendedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'system_users', key: 'id' },
    },
    attendedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    symptoms: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Descrição dos sintomas é obrigatória.' },
        len: { args: [5, 2000], msg: 'Sintomas devem ter entre 5 e 2000 caracteres.' },
      },
    },
    clinicalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    temperatureC: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
      validate: {
        min: { args: [30.0], msg: 'Temperatura abaixo de 30°C é considerada inválida.' },
        max: { args: [45.0], msg: 'Temperatura acima de 45°C é considerada inválida.' },
      },
    },
    bloodPressure: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
      validate: {
        isIn: {
          args: [['open', 'dispensed', 'referred', 'closed', 'blocked_allergy']],
          msg: 'Status inválido.',
        },
      },
    },
    referralDestination: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'attendances',
    modelName: 'Attendance',
    indexes: [
      // Relatórios de frequência e heatmap
      { fields: ['attended_at'] },
      // Histórico do aluno
      { fields: ['student_id', 'attended_at'] },
      { fields: ['attended_by'] },
      { fields: ['status'] },
    ],
  }
);