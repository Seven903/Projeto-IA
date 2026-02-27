// src/models/AuditLog.ts
// ============================================================
// Model: AuditLog
// Log de auditoria imutável — append-only por design.
//
// Imutabilidade garantida em dois níveis:
//   1. Hooks Sequelize (beforeUpdate, beforeDestroy e variantes bulk)
//      lançam erro se qualquer tentativa de modificação ocorrer.
//   2. Na camada de serviço, AuditLog.create() é o único método usado.
//
// Por que imutabilidade importa aqui?
//   • Registros de dispensação são evidência clínica e jurídica.
//   • Em caso de reação adversa ou investigação, o log deve ser
//     idêntico ao que ocorreu no momento do evento.
//   • Conformidade com LGPD — rastreabilidade de acesso a dados sensíveis.
//
// Ações auditadas (AuditAction):
//   LOGIN / LOGOUT              → acesso ao sistema
//   RECORD_VIEW                 → visualização de prontuário
//   DISPENSE_ATTEMPT            → tentativa de dispensação iniciada
//   DISPENSE_SUCCESS            → dispensação concluída com sucesso
//   DISPENSE_BLOCKED_ALLERGY    → dispensação bloqueada por conflito de alergia
//   STOCK_UPDATE                → alteração de estoque
//   STUDENT_CREATED/UPDATED     → cadastro e edição de aluno
//   ALLERGY_ADDED/REMOVED       → modificação na matriz de alergias
//   REPORT_GENERATED            → geração de relatório de BI
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
import { sequelize } from '../database/conection';

// ── Tipos exportados ─────────────────────────────────────────

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'RECORD_VIEW'
  | 'DISPENSE_ATTEMPT'
  | 'DISPENSE_SUCCESS'
  | 'DISPENSE_BLOCKED_ALLERGY'
  | 'STOCK_UPDATE'
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'ALLERGY_ADDED'
  | 'ALLERGY_REMOVED'
  | 'REPORT_GENERATED';

export interface AuditPayload {
  [key: string]: unknown;
}

export class AuditLog extends Model<
  InferAttributes<AuditLog>,
  InferCreationAttributes<AuditLog>
> {
  declare id: CreationOptional<number>; // INTEGER autoincrement — sequencial e auditável
  declare performedBy: string;          // FK system_users.id
  declare action: AuditAction;

  /** Nome da tabela afetada pela ação — Ex: "dispensations", "student_allergies" */
  declare targetTable: CreationOptional<string | null>;

  /** ID do registro afetado (UUID) */
  declare targetId: CreationOptional<string | null>;

  /**
   * Contexto completo da ação em JSON.
   * Inclui dados suficientes para reconstituir o evento sem joins adicionais.
   * Ex: { studentId, medicationName, activeIngredient, allergyConflict, severity }
   */
  declare payload: CreationOptional<AuditPayload | null>;

  /** Endereço IP de origem da requisição */
  declare ipAddress: CreationOptional<string | null>;

  declare userAgent: CreationOptional<string | null>;
  declare performedAt: CreationOptional<Date>;

  // AuditLog é append-only: sem updatedAt
  declare createdAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getPerformedByUser: BelongsToGetAssociationMixin<any>;

  declare static associations: {
    performedByUser: Association<AuditLog, any>;
  };
}

AuditLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'system_users', key: 'id' },
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [[
            'LOGIN', 'LOGOUT', 'RECORD_VIEW',
            'DISPENSE_ATTEMPT', 'DISPENSE_SUCCESS', 'DISPENSE_BLOCKED_ALLERGY',
            'STOCK_UPDATE',
            'STUDENT_CREATED', 'STUDENT_UPDATED',
            'ALLERGY_ADDED', 'ALLERGY_REMOVED',
            'REPORT_GENERATED',
          ]],
          msg: 'Ação de auditoria inválida.',
        },
      },
    },
    targetTable: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45), // Suporta IPv4 e IPv6
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    performedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    modelName: 'AuditLog',

    // Append-only: sem campo updatedAt
    timestamps: true,
    updatedAt: false,

    indexes: [
      // Busca de logs por usuário em período
      { fields: ['performed_by', 'performed_at'] },
      // Filtragem por tipo de ação
      { fields: ['action', 'performed_at'] },
      // Busca de histórico de um registro específico
      { fields: ['target_table', 'target_id'] },
    ],

    hooks: {
      // ── Imutabilidade garantida via hooks ──────────────────
      // Qualquer tentativa de modificar ou excluir um log lança erro.
      // Isso protege contra bugs na aplicação e uso acidental de métodos errados.

      beforeUpdate: () => {
        throw new Error(
          '[AuditLog] Operação proibida: registros de auditoria são IMUTÁVEIS. ' +
          'UPDATE não é permitido.'
        );
      },
      beforeDestroy: () => {
        throw new Error(
          '[AuditLog] Operação proibida: registros de auditoria são IMUTÁVEIS. ' +
          'DELETE não é permitido.'
        );
      },
      beforeBulkUpdate: () => {
        throw new Error(
          '[AuditLog] Operação proibida: registros de auditoria são IMUTÁVEIS. ' +
          'UPDATE em lote não é permitido.'
        );
      },
      beforeBulkDestroy: () => {
        throw new Error(
          '[AuditLog] Operação proibida: registros de auditoria são IMUTÁVEIS. ' +
          'DELETE em lote não é permitido.'
        );
      },
    },
  }
);