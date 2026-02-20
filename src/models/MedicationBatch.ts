// src/models/MedicationBatch.ts
// ============================================================
// Model: MedicationBatch
// Controle de lotes individuais de cada medicamento.
//
// Lógica de alertas:
//   isExpired       → expiryDate < hoje
//   isExpiringSoon  → expiryDate <= hoje + alertDaysBeforeExpiry (padrão 30 dias)
//   isLowStock      → quantityAvailable <= medication.minimumStockQty
//
// Fluxo de dispensação:
//   O StockService busca lotes disponíveis (quantityAvailable > 0)
//   ordenados por expiryDate ASC (FEFO — First Expired, First Out),
//   garantindo que lotes mais próximos do vencimento sejam usados primeiro.
//
// Integridade:
//   quantityAvailable jamais pode ser < 0 (validação + CHECK na camada de serviço)
//   Toda alteração de quantidade gera um registro em AuditLog.
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

export class MedicationBatch extends Model<
  InferAttributes<MedicationBatch>,
  InferCreationAttributes<MedicationBatch>
> {
  declare id: CreationOptional<string>;
  declare medicationId: string;
  declare batchNumber: string;
  declare manufacturer: CreationOptional<string | null>;

  /** Quantidade recebida originalmente no lote */
  declare quantityTotal: number;

  /** Quantidade atualmente disponível para dispensação */
  declare quantityAvailable: number;

  declare manufactureDate: CreationOptional<Date | null>;
  declare expiryDate: Date;

  /** Dias antes do vencimento para acionar alerta de proximidade */
  declare alertDaysBeforeExpiry: CreationOptional<number>;

  declare receivedAt: CreationOptional<Date>;
  /** FK system_users — farmacêutico que recebeu o lote */
  declare receivedBy: string;

  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getMedication: BelongsToGetAssociationMixin<any>;
  declare getDispensations: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    medication: Association<MedicationBatch, any>;
    dispensations: Association<MedicationBatch, any>;
    receivedByUser: Association<MedicationBatch, any>;
  };

  // ── Getters computados ───────────────────────────────────────

  /** Retorna true se o lote já venceu */
  get isExpired(): NonAttribute<boolean> {
    return new Date() > new Date(this.expiryDate);
  }

  /**
   * Retorna true se o lote vence dentro do período de alerta.
   * Padrão: 30 dias antes do vencimento.
   */
  get isExpiringSoon(): NonAttribute<boolean> {
    const alertThreshold = new Date(this.expiryDate);
    alertThreshold.setDate(
      alertThreshold.getDate() - (this.alertDaysBeforeExpiry ?? 30)
    );
    return new Date() >= alertThreshold;
  }

  /** Retorna true se o lote não tem mais unidades disponíveis */
  get isEmpty(): NonAttribute<boolean> {
    return this.quantityAvailable <= 0;
  }

  /**
   * Retorna o número de dias até o vencimento.
   * Negativo se já vencido.
   */
  get daysUntilExpiry(): NonAttribute<number> {
    const today = new Date();
    const expiry = new Date(this.expiryDate);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Retorna o percentual de unidades ainda disponíveis.
   * Ex: 75 significa que 75% do lote ainda está disponível.
   */
  get availabilityPercent(): NonAttribute<number> {
    if (this.quantityTotal === 0) return 0;
    return Math.round((this.quantityAvailable / this.quantityTotal) * 100);
  }

  // ── Métodos de negócio ───────────────────────────────────────

  /**
   * Verifica se é possível dispensar a quantidade solicitada.
   * Não modifica o estado — apenas valida.
   */
  canDispense(quantity: number): boolean {
    return !this.isExpired && this.quantityAvailable >= quantity;
  }
}

MedicationBatch.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    medicationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'medications', key: 'id' },
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Número do lote é obrigatório.' },
      },
    },
    manufacturer: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    quantityTotal: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: 'Quantidade total deve ser maior que zero.' },
      },
    },
    quantityAvailable: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [0], msg: 'Quantidade disponível não pode ser negativa.' },
      },
    },
    manufactureDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: 'Data de validade inválida.', args: true },
      },
    },
    alertDaysBeforeExpiry: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        min: { args: [1], msg: 'Dias de alerta deve ser pelo menos 1.' },
      },
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    receivedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'system_users', key: 'id' },
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
    tableName: 'medication_batches',
    modelName: 'MedicationBatch',
    indexes: [
      // Unicidade: mesmo medicamento não pode ter dois lotes com mesmo número
      {
        fields: ['medication_id', 'batch_number'],
        unique: true,
        name: 'uq_medication_batch_number',
      },
      // Busca de lotes disponíveis por medicamento (FEFO)
      { fields: ['medication_id', 'quantity_available'] },
      // Alertas de vencimento
      { fields: ['expiry_date'] },
    ],
  }
);