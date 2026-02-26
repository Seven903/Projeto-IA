// src/controllers/student.controller.ts
// ============================================================
// Controller de estudantes, prontuários e alergias.
//
// Rotas atendidas:
//   GET    /api/v1/students                       → lista com filtros
//   GET    /api/v1/students/search?q=matrícula    → busca por matrícula/nome
//   POST   /api/v1/students                       → cadastra novo estudante
//   GET    /api/v1/students/:id                   → busca por ID
//   PUT    /api/v1/students/:id                   → atualiza dados demográficos
//   GET    /api/v1/students/:id/health            → prontuário + alergias (requer nurse)
//   PUT    /api/v1/students/:id/health/conditions → atualiza condições crônicas
//   POST   /api/v1/students/:id/allergies         → adiciona alergia
//   DELETE /api/v1/students/:id/allergies/:allergyId → remove alergia
// ============================================================

import { Request, Response } from 'express';
import { StudentService } from '../src/services/validade/estoque/StudentService';
import { ValidationError, UniqueConstraintError } from 'sequelize';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendValidationError,
  sendForbidden,
  sendInternalError,
  buildPagination,
  parsePaginationQuery,
} from '../src/utils/responseBuilder';
import { StudentSearchQuery, IdParams, NestedIdParams } from '../src/types/api.types';

const studentService = new StudentService();

export class StudentController {

  // ── GET /students ────────────────────────────────────────

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const { rows, count, page, limit } = await studentService.listStudents(
        req.query as StudentSearchQuery
      );

      return sendSuccess(
        res,
        rows,
        200,
        buildPagination(count, page, limit)
      );

    } catch (error) {
      console.error('[StudentController.list]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /students/search ─────────────────────────────────

  async search(req: Request, res: Response): Promise<Response> {
    try {
      const q = String(req.query.q ?? '').trim();

      if (!q || q.length < 2) {
        return sendValidationError(
          res,
          'Informe ao menos 2 caracteres para busca.'
        );
      }

      // Tenta primeiro por matrícula exata (caminho mais rápido na tela de atendimento)
      const byEnrollment = await studentService.findByEnrollmentCode(q);

      if (byEnrollment) {
        return sendSuccess(res, [byEnrollment]);
      }

      // Fallback: busca textual por nome
      const { rows } = await studentService.listStudents({
        q,
        limit: '10',
        isActive: 'true',
      });

      return sendSuccess(res, rows);

    } catch (error) {
      console.error('[StudentController.search]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /students ───────────────────────────────────────

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;
      const body = req.body;

      if (!body.lgpdConsent) {
        return sendValidationError(
          res,
          'O consentimento LGPD do responsável legal é obrigatório para cadastrar o estudante.'
        );
      }

      const { student, healthRecord } = await studentService.createStudent(
        body,
        operator
      );

      return sendCreated(res, { student, healthRecord });

    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return sendValidationError(
          res,
          'Matrícula já cadastrada. Verifique o número informado.'
        );
      }
      if (error instanceof ValidationError) {
        return sendValidationError(
          res,
          error.errors.map((e) => e.message).join(' | '),
          error.errors
        );
      }
      if (error instanceof Error && error.message.includes('LGPD')) {
        return sendValidationError(res, error.message);
      }
      console.error('[StudentController.create]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /students/:id ────────────────────────────────────

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as unknown as IdParams;
      const { student } = await studentService.getHealthProfile(id, req.user!);

      if (!student) {
        return sendNotFound(res, 'Estudante');
      }

      return sendSuccess(res, student);

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrado')) {
        return sendNotFound(res, 'Estudante');
      }
      console.error('[StudentController.getById]', error);
      return sendInternalError(res, error);
    }
  }

  // ── PUT /students/:id ────────────────────────────────────

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as unknown as IdParams;
      const operator = req.user!;

      const student = await studentService.updateStudent(id, req.body, operator);

      return sendSuccess(res, student);

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrado')) {
        return sendNotFound(res, 'Estudante');
      }
      if (error instanceof ValidationError) {
        return sendValidationError(
          res,
          error.errors.map((e) => e.message).join(' | ')
        );
      }
      console.error('[StudentController.update]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /students/:id/health ─────────────────────────────

  async getHealthProfile(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;

      // Admins não acessam dados de saúde individuais — apenas BI anonimizado
      if (!operator.permissions.canAccessHealthData) {
        return sendForbidden(
          res,
          'Seu perfil não tem acesso a dados clínicos individuais. Use os relatórios de BI.'
        );
      }

      const { id } = req.params as unknown as IdParams;
      const profile = await studentService.getHealthProfile(id, operator);

      return sendSuccess(res, {
        student: {
          id: profile.student.id,
          enrollmentCode: profile.student.enrollmentCode,
          fullName: profile.student.fullName,
          birthDate: profile.student.birthDate,
          age: profile.student.age,
          gender: profile.student.gender,
          gradeClass: profile.student.gradeClass,
          guardianName: profile.student.guardianName,
          guardianPhone: profile.student.guardianPhone,
          guardianEmail: profile.student.guardianEmail,
          guardianRelation: profile.student.guardianRelation,
        },
        healthRecord: profile.healthRecord,
        allergies: profile.allergies,
        allergyCount: profile.allergies.length,
        hasBlockingAllergies: profile.allergies.some(
          (a) => a.severity === 'anaphylactic' || a.severity === 'severe'
        ),
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrado')) {
        return sendNotFound(res, 'Estudante');
      }
      console.error('[StudentController.getHealthProfile]', error);
      return sendInternalError(res, error);
    }
  }

  // ── PUT /students/:id/health/conditions ──────────────────

  async updateChronicConditions(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as unknown as IdParams;
      const operator = req.user!;
      const { chronicConditions } = req.body;

      if (!Array.isArray(chronicConditions)) {
        return sendValidationError(
          res,
          'O campo chronicConditions deve ser um array.'
        );
      }

      const record = await studentService.updateChronicConditions(
        id,
        chronicConditions,
        operator
      );

      return sendSuccess(res, record);

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrado')) {
        return sendNotFound(res, 'Prontuário');
      }
      console.error('[StudentController.updateChronicConditions]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /students/:id/allergies ─────────────────────────

  async addAllergy(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as unknown as IdParams;
      const operator = req.user!;

      const allergy = await studentService.addAllergy(id, req.body, operator);

      return sendCreated(res, allergy);

    } catch (error) {
      if (error instanceof Error && error.message.includes('Já existe')) {
        return sendValidationError(res, error.message);
      }
      if (error instanceof ValidationError) {
        return sendValidationError(
          res,
          error.errors.map((e) => e.message).join(' | ')
        );
      }
      console.error('[StudentController.addAllergy]', error);
      return sendInternalError(res, error);
    }
  }

  // ── DELETE /students/:id/allergies/:allergyId ────────────

  async removeAllergy(req: Request, res: Response): Promise<Response> {
    try {
      const { allergyId } = req.params as unknown as { allergyId: string };
      const operator = req.user!;

      await studentService.removeAllergy(allergyId, operator);

      return sendSuccess(res, {
        message: 'Alergia removida com sucesso.',
        affectedId: allergyId,
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrada')) {
        return sendNotFound(res, 'Alergia');
      }
      console.error('[StudentController.removeAllergy]', error);
      return sendInternalError(res, error);
    }
  }
}