// src/models/Medication.ts
// ============================================================
// Model: Medication
// Cadastro central de medicamentos do estoque da enfermaria.
//
// Campo activeIngredient:
//   Deve ser inserido normalizado (minúsculas, sem acentos) para
//   espelhar o campo homônimo em StudentAllergy e garantir o cross-check.
//   Use StudentAllergy.normalizeIngredient() antes de persistir.
//
// Campo minimumStockQty:
//   Quando o somatório de quantity_available de todos os lotes do
//   medicamento cair abaixo deste valor, um alerta é disparado
//   (verificado na view bi.stock_alerts e no StockService).
//
// Campo isControlled:
//   Indica substância sujeita à Portaria 344/98 (psicotrópicos,
//   entorpecentes). Requer controle especial de dispensação.
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  HasManyGetAssociationsMixin,
  Association,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../database/connection';

export class Medication extends Model<
  InferAttributes<Medication>,
  InferCreationAttributes<Medication>
> {
  declare id: CreationOptional<string>;

  /** Stock Keeping Unit — código único de identificação */
  declare sku: string;

  declare commercialName: string;

  /**
   * Princípio ativo NORMALIZADO — âncora do cross-check de alergia.
   * Deve espelhar StudentAllergy.activeIngredient.
   * Ex: "dipirona sodica", "ibuprofeno", "amoxicilina"
   */
  declare activeIngredient: string;

  /** Ex: "500mg", "10mg/mL", "250mg/5mL" */
  declare dosage: string;

  /** Ex: "Comprimido", "Cápsula", "Solução Oral", "Pomada" */
  declare pharmaceuticalForm: string;

  /** Unidade de medida para controle de estoque — Ex: "comprimido", "mL", "frasco" */
  declare unitMeasure: string;

  /** Dispara alerta quando o estoque total cai abaixo deste valor */
  declare minimumStockQty: CreationOptional<number>;

  /** Substância controlada pela Portaria 344/98 */
  declare isControlled: CreationOptional<boolean>;

  /** Requer receita médica para dispensação */
  declare requiresPrescription: CreationOptional<boolean>;

  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getBatches: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    batches: Association<Medication, any>;
  };

  // ── Métodos utilitários ──────────────────────────────────────

  /**
   * Retorna a descrição completa do medicamento para exibição.
   * Ex: "Novalgina 500mg — Comprimido (dipirona sodica)"
   */
  get fullDescription(): string {
    return `${this.commercialName} — ${this.pharmaceuticalForm} (${this.activeIngredient})`;
  }
}

Medication.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        name: 'uq_medications_sku',
        msg: 'Este SKU já está cadastrado.',
      },
      validate: {
        notEmpty: { msg: 'SKU é obrigatório.' },
      },
    },
    commercialName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome comercial é obrigatório.' },
      },
    },
    activeIngredient: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Princípio ativo é obrigatório.' },
        isLowercase(value: string) {
          if (value !== value.toLowerCase()) {
            throw new Error(
              'Princípio ativo deve estar em letras minúsculas. Use StudentAllergy.normalizeIngredient().'
            );
          }
        },
      },
    },
    dosage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Dosagem é obrigatória.' },
      },
    },
    pharmaceuticalForm: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Forma farmacêutica é obrigatória.' },
      },
    },
    unitMeasure: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Unidade de medida é obrigatória.' },
      },
    },
    minimumStockQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: { args: [0], msg: 'Estoque mínimo não pode ser negativo.' },
      },
    },
    isControlled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    requiresPrescription: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'medications',
    modelName: 'Medication',
    indexes: [
      { fields: ['sku'], unique: true },
      // Crítico para cross-check de alergia
      { fields: ['active_ingredient'] },
      { fields: ['is_active'] },
    ],
  }
);