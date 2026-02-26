// src/models/Student.ts
// ============================================================
// Model: Student
// Dados demográficos e contato do responsável legal.
//
// Princípio LGPD aplicado aqui:
//   Os dados de saúde (alergias, prontuário) residem em modelos
//   separados (StudentHealthRecord, StudentAllergy) para que a
//   camada de autorização possa bloquear acesso granularmente.
//   Um usuário com role 'admin' jamais recebe JOIN com saúde.
//
// Campo enrollmentCode:
//   Identificador primário de busca na tela de atendimento.
//   Indexado para busca O(log n).
// ============================================================

import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  HasOneGetAssociationMixin,
  HasManyGetAssociationsMixin,
  Association,
} from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelize } from '../database/conection';

export type Gender = 'male' | 'female' | 'non_binary' | 'not_informed';

export class Student extends Model<
  InferAttributes<Student>,
  InferCreationAttributes<Student>
> {
  declare id: CreationOptional<string>;

  /** Matrícula institucional — chave de busca na tela de atendimento */
  declare enrollmentCode: string;
  declare fullName: string;
  declare birthDate: Date;
  declare gender: CreationOptional<Gender>;

  /** Turma/série — Ex: "3°A-Ensino Médio", "9°B-Fund. II" */
  declare gradeClass: CreationOptional<string | null>;

  // ── Responsável legal ────────────────────────────────────────
  declare guardianName: string;
  declare guardianPhone: string;
  declare guardianEmail: CreationOptional<string | null>;
  /** Relação com o estudante — Ex: "mãe", "pai", "avó", "tutor legal" */
  declare guardianRelation: CreationOptional<string | null>;

  // ── Conformidade LGPD — Art. 14 (dados de menores) ──────────
  /** Consentimento explícito e registrado do responsável legal */
  declare lgpdConsent: CreationOptional<boolean>;
  /** Timestamp do momento do consentimento — evidência jurídica */
  declare lgpdConsentAt: CreationOptional<Date | null>;

  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // ── Mixins de associação ─────────────────────────────────────
  declare getHealthRecord: HasOneGetAssociationMixin<any>;
  declare getAllergies: HasManyGetAssociationsMixin<any>;
  declare getAttendances: HasManyGetAssociationsMixin<any>;

  declare static associations: {
    healthRecord: Association<Student, any>;
    allergies: Association<Student, any>;
    attendances: Association<Student, any>;
  };

  // ── Getters computados ───────────────────────────────────────

  /** Calcula a idade atual do estudante em anos completos */
  get age(): NonAttribute<number> {
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /** Retorna o nome completo formatado para exibição */
  get displayName(): NonAttribute<string> {
    return this.fullName
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }
}

Student.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    enrollmentCode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: {
        name: 'uq_students_enrollment_code',
        msg: 'Esta matrícula já está cadastrada.',
      },
      validate: {
        notEmpty: { msg: 'Matrícula é obrigatória.' },
      },
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome completo é obrigatório.' },
        len: { args: [3, 150], msg: 'Nome deve ter entre 3 e 150 caracteres.' },
      },
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: 'Data de nascimento inválida.', args: true },
        isBefore: {
          args: new Date().toISOString(),
          msg: 'Data de nascimento não pode ser no futuro.',
        },
      },
    },
    gender: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'not_informed',
      validate: {
        isIn: {
          args: [['male', 'female', 'non_binary', 'not_informed']],
          msg: 'Gênero inválido.',
        },
      },
    },
    gradeClass: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    guardianName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Nome do responsável é obrigatório.' },
      },
    },
    guardianPhone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Telefone do responsável é obrigatório.' },
      },
    },
    guardianEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: { msg: 'E-mail do responsável inválido.' },
      },
    },
    guardianRelation: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    lgpdConsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lgpdConsentAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'students',
    modelName: 'Student',
    indexes: [
      { fields: ['enrollment_code'], unique: true },
      { fields: ['full_name'] },
      { fields: ['grade_class', 'is_active'] },
      { fields: ['is_active'] },
    ],
  }
);