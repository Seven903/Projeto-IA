// src/services/StudentService.ts
// ============================================================
// Serviço de gestão de estudantes.
//
// Responsabilidades:
//   • CRUD de estudantes (dados demográficos)
//   • Criação e atualização de prontuários eletrônicos
//   • Gerenciamento de alergias (adicionar, remover, listar)
//   • Busca por matrícula (caminho principal do atendimento)
//   • Registro de AuditLog em todas as operações sensíveis
//
// Conformidade LGPD:
//   • Toda criação de estudante exige lgpdConsent=true
//   • Acesso ao prontuário e alergias gera AuditLog de RECORD_VIEW
//   • Dados de saúde nunca são retornados para role 'admin'
// ============================================================

import { Op } from 'sequelize';
import { Student } from '../models/Student';
import { StudentHealthRecord } from '../models/StudentHealthRecord';
import { StudentAllergy } from '../models/StudentAllergy';
import { AuditLog } from '../models/AuditLog';
import { sequelize } from '../database/connection';
import { normalizeIngredient, normalizeName } from '../utils/normalize';
import { AuthenticatedUser } from '../types/express.d';
import { StudentSearchQuery } from '../types/api.types';
import { ChronicCondition } from '../models/StudentHealthRecord';
import { v4 as uuidv4 } from 'uuid';

export class StudentService {

  // ── Busca de estudantes ──────────────────────────────────

  /**
   * Busca estudante por matrícula — caminho principal da tela de atendimento.
   * Retorna dados demográficos. Prontuário e alergias requerem chamada separada.
   *
   * @param enrollmentCode - Matrícula institucional
   * @returns Estudante ou null se não encontrado
   */
  async findByEnrollmentCode(enrollmentCode: string): Promise<Student | null> {
    return Student.findOne({
      where: {
        enrollmentCode: enrollmentCode.trim().toUpperCase(),
        isActive: true,
      },
    });
  }

  /**
   * Lista estudantes com filtros, busca textual e paginação.
   */
  async listStudents(query: StudentSearchQuery) {
    const {
      page = '1',
      limit = '20',
      q,
      gradeClass,
      isActive = 'true',
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (isActive !== 'all') {
      where.isActive = isActive !== 'false';
    }

    if (gradeClass) {
      where.gradeClass = gradeClass;
    }

    if (q) {
      const normalizedQ = normalizeName(q);
      where[Op.or as unknown as string] = [
        { enrollmentCode: { [Op.like]: `%${q.toUpperCase()}%` } },
        { fullName: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await Student.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['fullName', 'ASC']],
      attributes: [
        'id', 'enrollmentCode', 'fullName', 'birthDate',
        'gender', 'gradeClass', 'guardianName',
        'guardianPhone', 'isActive', 'createdAt',
      ],
    });

    return { rows, count, page: pageNum, limit: limitNum };
  }

  // ── Criação e atualização ────────────────────────────────

  /**
   * Cria um novo estudante com prontuário eletrônico inicial.
   * Operação atômica: estudante + prontuário criados juntos ou nenhum.
   *
   * @throws Error se lgpdConsent não for true
   */
  async createStudent(
    data: {
      enrollmentCode: string;
      fullName: string;
      birthDate: Date;
      gender?: Student['gender'];
      gradeClass?: string;
      guardianName: string;
      guardianPhone: string;
      guardianEmail?: string;
      guardianRelation?: string;
      lgpdConsent: boolean;
      bloodType?: StudentHealthRecord['bloodType'];
    },
    operator: AuthenticatedUser
  ): Promise<{ student: Student; healthRecord: StudentHealthRecord }> {

    if (!data.lgpdConsent) {
      throw new Error(
        'Cadastro não autorizado: o consentimento LGPD do responsável legal é obrigatório (Art. 14 da LGPD).'
      );
    }

    const transaction = await sequelize.transaction();

    try {
      const studentId = uuidv4();

      const student = await Student.create(
        {
          id: studentId,
          enrollmentCode: data.enrollmentCode.trim().toUpperCase(),
          fullName: data.fullName.trim(),
          birthDate: data.birthDate,
          gender: data.gender ?? 'not_informed',
          gradeClass: data.gradeClass ?? null,
          guardianName: data.guardianName.trim(),
          guardianPhone: data.guardianPhone.trim(),
          guardianEmail: data.guardianEmail?.trim() ?? null,
          guardianRelation: data.guardianRelation?.trim() ?? null,
          lgpdConsent: true,
          lgpdConsentAt: new Date(),
          isActive: true,
        },
        { transaction }
      );

      const healthRecord = await StudentHealthRecord.create(
        {
          id: uuidv4(),
          studentId: studentId,
          chronicConditions: [],
          bloodType: data.bloodType ?? null,
          generalNotes: null,
        },
        { transaction }
      );

      await AuditLog.create(
        {
          performedBy: operator.id,
          action: 'STUDENT_CREATED',
          targetTable: 'students',
          targetId: studentId,
          payload: {
            enrollmentCode: student.enrollmentCode,
            fullName: student.fullName,
            gradeClass: student.gradeClass,
            lgpdConsentAt: student.lgpdConsentAt,
          },
        },
        { transaction }
      );

      await transaction.commit();

      return { student, healthRecord };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Atualiza dados demográficos de um estudante.
   * Não permite alterar enrollmentCode (identificador imutável).
   */
  async updateStudent(
    studentId: string,
    data: Partial<Pick<Student, 'fullName' | 'gradeClass' | 'guardianName' | 'guardianPhone' | 'guardianEmail' | 'guardianRelation' | 'gender'>>,
    operator: AuthenticatedUser
  ): Promise<Student> {
    const student = await Student.findByPk(studentId);

    if (!student) {
      throw new Error(`Estudante "${studentId}" não encontrado.`);
    }

    const previousData = {
      fullName: student.fullName,
      gradeClass: student.gradeClass,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
    };

    await student.update(data);

    await AuditLog.create({
      performedBy: operator.id,
      action: 'STUDENT_UPDATED',
      targetTable: 'students',
      targetId: studentId,
      payload: { previousData, newData: data },
    });

    return student;
  }

  // ── Prontuário eletrônico ────────────────────────────────

  /**
   * Retorna o prontuário completo do estudante com alergias.
   * Gera AuditLog de RECORD_VIEW — toda visualização é rastreada.
   *
   * @param studentId - UUID do estudante
   * @param operator  - Usuário que está acessando (para o AuditLog)
   */
  async getHealthProfile(
    studentId: string,
    operator: AuthenticatedUser
  ): Promise<{
    student: Student;
    healthRecord: StudentHealthRecord | null;
    allergies: StudentAllergy[];
  }> {
    const student = await Student.findByPk(studentId);

    if (!student) {
      throw new Error(`Estudante "${studentId}" não encontrado.`);
    }

    const [healthRecord, allergies] = await Promise.all([
      StudentHealthRecord.findOne({ where: { studentId } }),
      StudentAllergy.findAll({
        where: { studentId },
        order: [['createdAt', 'ASC']],
      }),
    ]);

    // Toda visualização de prontuário é auditada — exigência da LGPD
    await AuditLog.create({
      performedBy: operator.id,
      action: 'RECORD_VIEW',
      targetTable: 'students',
      targetId: studentId,
      payload: {
        studentName: student.fullName,
        enrollmentCode: student.enrollmentCode,
        allergyCount: allergies.length,
        accessedAt: new Date().toISOString(),
      },
    });

    return { student, healthRecord, allergies };
  }

  /**
   * Atualiza condições crônicas no prontuário do estudante.
   */
  async updateChronicConditions(
    studentId: string,
    chronicConditions: ChronicCondition[],
    operator: AuthenticatedUser
  ): Promise<StudentHealthRecord> {
    const record = await StudentHealthRecord.findOne({ where: { studentId } });

    if (!record) {
      throw new Error(`Prontuário do estudante "${studentId}" não encontrado.`);
    }

    await record.update({ chronicConditions });

    await AuditLog.create({
      performedBy: operator.id,
      action: 'STUDENT_UPDATED',
      targetTable: 'student_health_records',
      targetId: record.id,
      payload: {
        studentId,
        updatedField: 'chronicConditions',
        conditionCount: chronicConditions.length,
      },
    });

    return record;
  }

  // ── Alergias ─────────────────────────────────────────────

  /**
   * Adiciona uma alergia ao perfil do estudante.
   * Normaliza o activeIngredient antes de persistir.
   *
   * @throws Error se o estudante já tiver alergia ao mesmo princípio ativo
   */
  async addAllergy(
    studentId: string,
    data: {
      activeIngredient: string;
      allergenName: string;
      severity: StudentAllergy['severity'];
      reactionDescription?: string;
      diagnosedBy?: string;
      diagnosedAt?: Date;
    },
    operator: AuthenticatedUser
  ): Promise<StudentAllergy> {
    const normalizedIngredient = normalizeIngredient(data.activeIngredient);

    // Verifica duplicata
    const existing = await StudentAllergy.findOne({
      where: { studentId, activeIngredient: normalizedIngredient },
    });

    if (existing) {
      throw new Error(
        `Já existe uma alergia cadastrada para o princípio ativo "${normalizedIngredient}" neste estudante.`
      );
    }

    const allergy = await StudentAllergy.create({
      id: uuidv4(),
      studentId,
      activeIngredient: normalizedIngredient,
      allergenName: data.allergenName.trim(),
      severity: data.severity,
      reactionDescription: data.reactionDescription?.trim() ?? null,
      diagnosedBy: data.diagnosedBy?.trim() ?? null,
      diagnosedAt: data.diagnosedAt ?? null,
      createdBy: operator.id,
    });

    await AuditLog.create({
      performedBy: operator.id,
      action: 'ALLERGY_ADDED',
      targetTable: 'student_allergies',
      targetId: allergy.id,
      payload: {
        studentId,
        activeIngredient: normalizedIngredient,
        allergenName: allergy.allergenName,
        severity: allergy.severity,
      },
    });

    return allergy;
  }

  /**
   * Remove uma alergia do perfil do estudante.
   * Gera AuditLog de ALLERGY_REMOVED — remoção é sempre rastreada.
   */
  async removeAllergy(
    allergyId: string,
    operator: AuthenticatedUser
  ): Promise<void> {
    const allergy = await StudentAllergy.findByPk(allergyId);

    if (!allergy) {
      throw new Error(`Alergia "${allergyId}" não encontrada.`);
    }

    await AuditLog.create({
      performedBy: operator.id,
      action: 'ALLERGY_REMOVED',
      targetTable: 'student_allergies',
      targetId: allergyId,
      payload: {
        studentId: allergy.studentId,
        activeIngredient: allergy.activeIngredient,
        allergenName: allergy.allergenName,
        severity: allergy.severity,
        removedAt: new Date().toISOString(),
        removedBy: operator.fullName,
      },
    });

    await allergy.destroy();
  }
}