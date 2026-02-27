// src/controllers/report.controller.ts
// ============================================================
// Controller de relatórios e Business Intelligence.
//
// Rotas atendidas:
//   GET /api/v1/reports/dashboard          → resumo da tela inicial
//   GET /api/v1/reports/heatmap            → frequência de atendimentos
//   GET /api/v1/reports/medications/abc    → curva ABC de consumo
//   GET /api/v1/reports/allergies/coverage → cobertura de alergias mapeadas
//   GET /api/v1/reports/attendances/by-day → atendimentos agrupados por dia
//   GET /api/v1/reports/attendances/by-status → atendimentos por status
//
// Todos os endpoints retornam dados ANONIMIZADOS.
// Acessível para todas as roles (nurse, pharmacist, admin, superadmin).
// ============================================================

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ReportService } from '../src/services/validade/estoque/ReportService';
import { AuditLog } from '../src/models/AuditLog';
import { SystemUser } from '../src/models/SystemUser';
import {
  sendSuccess,
  sendForbidden,
  sendValidationError,
  sendInternalError,
  buildPagination,
  parsePaginationQuery,
} from '../src/utils/responseBuilder';
import { AuditLogSearchQuery, DateRangeQuery } from '../src/types/api.types';
import { parseDateRangeFromQuery } from '../src/utils/dateHelpers';

const reportService = new ReportService();

export class ReportController {

  // ── GET /reports/dashboard ───────────────────────────────

  async getDashboard(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;
      const summary = await reportService.getDashboardSummary(operator);

      return sendSuccess(res, summary);

    } catch (error) {
      console.error('[ReportController.getDashboard]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/heatmap ─────────────────────────────────

  async getHeatmap(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const heatmap = await reportService.getAttendanceHeatmap(
        startDate,
        endDate
      );

      // Estatísticas rápidas para complementar o heatmap
      const totalAttendances = heatmap.reduce((sum, p) => sum + p.count, 0);
      const peakSlot = heatmap.reduce(
        (max, p) => (p.count > max.count ? p : max),
        heatmap[0]
      );

      return sendSuccess(res, {
        heatmap,
        summary: {
          totalAttendances,
          peakSlot: totalAttendances > 0
            ? {
                weekdayLabel: peakSlot.weekdayLabel,
                hourLabel: peakSlot.hourLabel,
                count: peakSlot.count,
              }
            : null,
        },
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('data')) {
        return sendValidationError(res, error.message);
      }
      console.error('[ReportController.getHeatmap]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/medications/abc ─────────────────────────

  async getMedicationAbc(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const abcCurve = await reportService.getMedicationAbcCurve(
        startDate,
        endDate
      );

      // Agrupa por classe para resumo executivo
      const classA = abcCurve.filter((i) => i.abcClass === 'A');
      const classB = abcCurve.filter((i) => i.abcClass === 'B');
      const classC = abcCurve.filter((i) => i.abcClass === 'C');

      const totalDispensed = abcCurve.reduce(
        (sum, i) => sum + i.totalDispensed,
        0
      );

      return sendSuccess(res, {
        items: abcCurve,
        summary: {
          totalItems: abcCurve.length,
          totalDispensed,
          classA: { count: classA.length, items: classA },
          classB: { count: classB.length, items: classB },
          classC: { count: classC.length, items: classC },
        },
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('data')) {
        return sendValidationError(res, error.message);
      }
      console.error('[ReportController.getMedicationAbc]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/allergies/coverage ─────────────────────

  async getAllergyCoverage(req: Request, res: Response): Promise<Response> {
    try {
      const coverage = await reportService.getAllergyCoverage();

      return sendSuccess(res, coverage);

    } catch (error) {
      console.error('[ReportController.getAllergyCoverage]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/attendances/by-day ─────────────────────

  async getAttendancesByDay(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const data = await reportService.getAttendancesByDay(startDate, endDate);

      const total = data.reduce((sum, d) => sum + d.count, 0);
      const average = data.length > 0
        ? Math.round((total / data.length) * 10) / 10
        : 0;

      return sendSuccess(res, {
        data,
        summary: {
          totalDays: data.length,
          totalAttendances: total,
          averagePerDay: average,
          peakDay: data.length > 0
            ? data.reduce((max, d) => (d.count > max.count ? d : max))
            : null,
        },
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('data')) {
        return sendValidationError(res, error.message);
      }
      console.error('[ReportController.getAttendancesByDay]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/attendances/by-status ──────────────────

  async getAttendancesByStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const data = await reportService.getAttendancesByStatus(
        startDate,
        endDate
      );

      const total = data.reduce((sum, d) => sum + d.count, 0);

      // Enriquece com percentual por status
      const enriched = data.map((d) => ({
        ...d,
        percent: total > 0
          ? Math.round((d.count / total) * 10000) / 100
          : 0,
      }));

      return sendSuccess(res, {
        data: enriched,
        summary: { total },
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('data')) {
        return sendValidationError(res, error.message);
      }
      console.error('[ReportController.getAttendancesByStatus]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /reports/audit ───────────────────────────────────

  async getAuditLog(req: Request, res: Response): Promise<Response> {
    try {
      if (req.user?.role !== 'superadmin') {
        return sendForbidden(res, 'Apenas superadmins podem visualizar logs de auditoria.');
      }

      const { page, limit, offset } = parsePaginationQuery(req.query);
      const query = req.query as AuditLogSearchQuery;
      const { start, end } = parseDateRangeFromQuery(query.startDate, query.endDate);

      const where: Record<string, unknown> = {
        performedAt: { [Op.between]: [start, end] },
      };

      if (query.performedBy) where.performedBy = query.performedBy;
      if (query.action)      where.action = query.action;
      if (query.targetTable) where.targetTable = query.targetTable;

      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        limit,
        offset,
        order: [['performedAt', 'DESC']],
        include: [
          {
            model: SystemUser,
            as: 'performedByUser',
            attributes: ['id', 'fullName', 'role'],
          },
        ],
      });

      return sendSuccess(res, rows, 200, buildPagination(count, page, limit));

    } catch (error) {
      console.error('[ReportController.getAuditLog]', error);
      return sendInternalError(res, error);
    }
  }
}