// src/models/SystemUser.ts
// ============================================================
// Model: SystemUser
// Representa todos os profissionais que operam o sistema.
//
// Roles disponíveis:
//   nurse        → acesso total a prontuários e dispensação
//   pharmacist   → acesso total a estoque e dispensação
//   admin        → acesso apenas a estatísticas anonimizadas (BI)
//   superadmin   → acesso irrestrito
//
// Segurança:
//   • defaultScope exclui passwordHash de TODAS as queries por padrão
//   • scope('withPassword') inclui o hash apenas no fluxo de login
//   • Senha nunca trafega na API — apenas o hash bcrypt é armazenado
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
  HasManyGetAssociationsMixin,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { sequelize } from '../database/connection';

// ── Tipos exportados ─────────────────────────────────────────
export type UserRole = 'nurse' | 'pharmacist' | 'admin' | 'superadmin';

export class SystemUser extends Model<
  InferAttributes<SystemUser>,
  InferCreationAttributes<SystemUser>
> {
  declare id: CreationOptional<string>;
  declare fullName: string;
  declare email: string;
  declare passwordHash: string;
  declare role: UserRole;
  /** Número do conselho profissional: COREN, CRF, CRM */
  declare councilNumber: CreationOptional<string | null>;
  declare isActive: CreationOptional<boolean>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getAuditLogs: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    auditLogs: Association<SystemUser, any>;
    allergiesCreated: Association<SystemUser, any>;
    batchesReceived: Association<SystemUser, any>;
    attendancesGiven: Association<SystemUser, any>;
    dispensationsGiven: Association<SystemUser, any>;
  };

  // ── Getters computados (NonAttribute = não persistido no banco) ──

  /**
   * Retorna true se o usuário pode visualizar dados clínicos de saúde.
   * Admins são redirecionados às views anonimizadas de BI.
   */
  get canAccessHealthData(): NonAttribute<boolean> {
    return ['nurse', 'pharmacist', 'superadmin'].includes(this.role);
  }

  /**
   * Retorna true se o usuário pode realizar dispensação de medicamentos.
   */
  get canDispense(): NonAttribute<boolean> {
    return ['nurse', 'pharmacist', 'superadmin'].includes(this.role);
  }

  /**
   * Retorna true se o usuário pode gerenciar estoque (receber lotes, editar).
   */
  get canManageStock(): NonAttribute<boolean> {
    return ['pharmacist', 'superadmin'].includes(this.role);
  }

  /**
   * Retorna true se o usuário pode acessar relatórios de BI.
   * Todos os roles têm acesso, mas admins veem apenas dados anonimizados.
   */
  get canAccessReports(): NonAttribute<boolean> {
    return true;
  }

  // ── Métodos de instância ─────────────────────────────────────

  /**
   * Verifica a senha fornecida contra o hash bcrypt armazenado.
   * Utilizado exclusivamente no fluxo de autenticação.
   */
  async verifyPassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.passwordHash);
  }

  /**
   * Retorna representação segura do usuário (sem hash de senha).
   * Usado para incluir no payload do JWT e respostas de API.
   */
  toSafeObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      role: this.role,
      councilNumber: this.councilNumber,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt,
      canAccessHealthData: this.canAccessHealthData,
      canDispense: this.canDispense,
      canManageStock: this.canManageStock,
    };
  }

  // ── Métodos estáticos ────────────────────────────────────────

  /**
   * Gera hash bcrypt com custo 12 (recomendação OWASP para 2024).
   * Custo 12 ≈ 300ms — aceitável para login, inviável para brute-force.
   */
  static async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, 12);
  }
}

SystemUser.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome completo é obrigatório.' },
        len: { args: [3, 150], msg: 'Nome deve ter entre 3 e 150 caracteres.' },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'uq_system_users_email',
        msg: 'Este e-mail já está cadastrado no sistema.',
      },
      validate: {
        isEmail: { msg: 'Formato de e-mail inválido.' },
        notEmpty: { msg: 'E-mail é obrigatório.' },
      },
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: {
          args: [['nurse', 'pharmacist', 'admin', 'superadmin']],
          msg: 'Role inválida. Valores aceitos: nurse, pharmacist, admin, superadmin.',
        },
      },
    },
    councilNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'system_users',
    modelName: 'SystemUser',

    // Exclui passwordHash de TODAS as queries por padrão
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },

    // Scope especial: inclui passwordHash (apenas para autenticação)
    scopes: {
      withPassword: {
        attributes: {
          include: ['passwordHash'],
        },
      },
    },

    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['role'] },
      { fields: ['is_active'] },
    ],
  }
);