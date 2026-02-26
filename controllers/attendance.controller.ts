// src/controllers/attendance.controller.ts
// ============================================================
// Controller de atendimentos clínicos.
//
// Rotas atendidas:
//   GET  /api/v1/attendances          → lista atendimentos com filtros
//   POST /api/v1/attendances          → abre novo atendimento
//   GET  /api/v1/attendances/:id      → detalhes de um atendimento
//   PUT  /api/v1/attendances/:id/close → encerra atendimento
//   GET  /api/v1/attendances/open     → atendimentos em aberto agora
// ============================================================

import { Request, Response } from 'express';
import { Attendance } from '../models/Attendance';
import { Student } from '../models/Student';
import { SystemUser } from '../models/SystemUser';
import { Dispensation } from '../models/Dispensation';
import { MedicationBatch } from '../models/MedicationBatch';
import { Medication } from '../models/Medication';
import { StudentAllergy } from '../models/StudentAllergy';
import { Op } from 'sequelize';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendValidationError,
  sendForbidden,
  sendInternalError,
  buildPagination,
  parsePaginationQuery,
} from '../utils/responseBuilder';
import { OpenAttendanceDto, CloseAttendanceDto, AttendanceSearchQuery } from '../types/dispensation.types';
import { parseDateRangeFromQuery } from '../utils/dateHelpers';
import { v4 as uuidv4 } from 'uuid';

export class AttendanceController {

  // ── GET /attendances ─────────────────────────────────────

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const { page, limit, offset } = parsePaginationQuery(req.query);
      const query = req.query as unknown as AttendanceSearchQuery;

      const where: Record<string, unknown> = {};

      if (query.status) {
        where.status = query.status;
      }

      if (query.studentId) {
        where.studentId = query.studentId;
      }

      if (query.attendedBy) {
        where.attendedBy = query.attendedBy;
      }

      if (query.startDate || query.endDate) {
        const { start, end } = parseDateRangeFromQuery(
          query.startDate,
          query.endDate
        );
        where.attendedAt = { [Op.between]: [start, end] };
      }

      const { rows, count } = await Attendance.findAndCountAll({
        where,
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'fullName', 'enrollmentCode', 'gradeClass'],
          },
          {
            model: SystemUser,
            as: 'attendedByUser',
            attributes: ['id', 'fullName', 'role'],
          },
        ],
        order: [['attended_at', 'DESC']],
        limit,
        offset,
      });

      return sendSuccess(res, rows, 200, buildPagination(count, page, limit));

    } catch (error) {
      console.error('[AttendanceController.list]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /attendances/open ────────────────────────────────

  async listOpen(req: Request, res: Response): Promise<Response> {
    try {
      const attendances = await Attendance.findAll({
        where: { status: 'open' },
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['id', 'fullName', 'enrollmentCode', 'gradeClass'],
          },
          {
            model: SystemUser,
            as: 'attendedByUser',
            attributes: ['id', 'fullName'],
          },
        ],
        order: [['attended_at', 'ASC']], // Mais antigo primeiro (ordem de chegada)
      });

      return sendSuccess(res, attendances);

    } catch (error) {
      console.error('[AttendanceController.listOpen]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /attendances ────────────────────────────────────

  async open(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;

      if (!operator.permissions.canDispense) {
        return sendForbidden(
          res,
          'Apenas enfermeiros e farmacêuticos podem registrar atendimentos.'
        );
      }

      const body = req.body as OpenAttendanceDto;

      if (!body.studentId) {
        return sendValidationError(res, 'ID do estudante é obrigatório.');
      }

      if (!body.symptoms || body.symptoms.trim().length < 5) {
        return sendValidationError(
          res,
          'Descrição dos sintomas é obrigatória (mínimo 5 caracteres).'
        );
      }

      // Verifica se o estudante existe e está ativo
      const student = await Student.findOne({
        where: { id: body.studentId, isActive: true },
      });

      if (!student) {
        return sendNotFound(res, 'Estudante');
      }

      // Verifica se aluno já tem atendimento em aberto
      const existingOpen = await Attendance.findOne({
        where: { studentId: body.studentId, status: 'open' },
      });

      if (existingOpen) {
        return sendValidationError(
          res,
          `Este estudante já possui um atendimento em aberto (ID: ${existingOpen.id}). Encerre-o antes de abrir outro.`
        );
      }

      // Busca alergias bloqueantes para exibir alerta ao abrir atendimento
      const blockingAllergies = await StudentAllergy.findAll({
        where: {
          studentId: body.studentId,
          severity: ['anaphylactic', 'severe'],
        },
        attributes: ['id', 'allergenName', 'activeIngredient', 'severity'],
      });

      const attendance = await Attendance.create({
        id: uuidv4(),
        studentId: body.studentId,
        attendedBy: operator.id,
        symptoms: body.symptoms.trim(),
        clinicalNotes: body.clinicalNotes?.trim() ?? null,
        temperatureC: body.temperatureC ?? null,
        bloodPressure: body.bloodPressure ?? null,
        status: 'open',
      });

      return sendCreated(res, {
        attendance,
        student: {
          id: student.id,
          fullName: student.fullName,
          enrollmentCode: student.enrollmentCode,
          gradeClass: student.gradeClass,
          age: student.age,
        },
        // Alerta imediato de alergias graves ao abrir o atendimento
        allergyAlerts: blockingAllergies.length > 0
          ? {
              hasBlockingAllergies: true,
              count: blockingAllergies.length,
              allergies: blockingAllergies,
              warning: '⚠️ Este paciente possui alergias GRAVES. Verifique antes de qualquer medicação.',
            }
          : { hasBlockingAllergies: false, count: 0, allergies: [] },
      });

    } catch (error) {
      console.error('[AttendanceController.open]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /attendances/:id ─────────────────────────────────

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const attendance = await Attendance.findByPk(id, {
        include: [
          {
            model: Student,
            as: 'student',
            attributes: [
              'id', 'fullName', 'enrollmentCode',
              'gradeClass', 'birthDate',
              'guardianName', 'guardianPhone',
            ],
          },
          {
            model: SystemUser,
            as: 'attendedByUser',
            attributes: ['id', 'fullName', 'role'],
          },
          {
            model: Dispensation,
            as: 'dispensations',
            include: [
              {
                model: MedicationBatch,
                as: 'batch',
                include: [
                  {
                    model: Medication,
                    as: 'medication',
                    attributes: [
                      'id', 'commercialName',
                      'activeIngredient', 'dosage', 'pharmaceuticalForm',
                    ],
                  },
                ],
              },
              {
                model: SystemUser,
                as: 'dispensedByUser',
                attributes: ['id', 'fullName'],
              },
            ],
          },
        ],
      });

      if (!attendance) {
        return sendNotFound(res, 'Atendimento');
      }

      return sendSuccess(res, {
        ...attendance.toJSON(),
        statusLabel: attendance.statusLabel,
        durationMinutes: attendance.durationMinutes,
      });

    } catch (error) {
      console.error('[AttendanceController.getById]', error);
      return sendInternalError(res, error);
    }
  }

  // ── PUT /attendances/:id/close ───────────────────────────

  async close(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const operator = req.user!;
      const body = req.body as CloseAttendanceDto;

      const attendance = await Attendance.findByPk(id);

      if (!attendance) {
        return sendNotFound(res, 'Atendimento');
      }

      if (attendance.status !== 'open') {
        return sendValidationError(
          res,
          `Atendimento já está encerrado com status "${attendance.status}".`
        );
      }

      const validClosingStatuses = ['referred', 'closed'];
      if (!body.status || !validClosingStatuses.includes(body.status)) {
        return sendValidationError(
          res,
          `Status de encerramento inválido. Use: ${validClosingStatuses.join(', ')}.`
        );
      }

      if (body.status === 'referred' && !body.referralDestination) {
        return sendValidationError(
          res,
          'Destino do encaminhamento é obrigatório quando status = "referred".'
        );
      }

      await attendance.update({
        status: body.status,
        clinicalNotes: body.clinicalNotes ?? attendance.clinicalNotes,
        referralDestination: body.referralDestination ?? null,
        closedAt: new Date(),
      });

      return sendSuccess(res, {
        ...attendance.toJSON(),
        statusLabel: attendance.statusLabel,
      });

    } catch (error) {
      console.error('[AttendanceController.close]', error);
      return sendInternalError(res, error);
    }
  }
}