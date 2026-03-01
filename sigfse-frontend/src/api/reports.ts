// src/api/reports.ts
// Conecta com as rotas do backend em src/routes/report.routes.ts:
//   GET /api/v1/reports/dashboard              → ReportController.getDashboard
//   GET /api/v1/reports/heatmap                → ReportController.getHeatmap
//   GET /api/v1/reports/medications/abc        → ReportController.getMedicationAbc
//   GET /api/v1/reports/allergies/coverage     → ReportController.getAllergyCoverage
//   GET /api/v1/reports/attendances/by-day     → ReportController.getAttendancesByDay
//   GET /api/v1/reports/attendances/by-status  → ReportController.getAttendancesByStatus
//   GET /api/v1/reports/audit                  → ReportController.getAuditLog (superadmin)
//
// Datas aceitas pelo reportDateRangeSchema: YYYY-MM-DD, range máx 2 anos

import { api } from './client';
import type {
  ApiSuccessResponse,
  DashboardSummary,
  HeatmapPoint,
  AbcItem,
  AllergyCoverage,
  AttendanceByDay,
  AttendanceByStatus,
  AuditLog,
} from '../types';

interface DateRange {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export const reportsApi = {
  // Retorna DashboardSummaryDto: attendancesToday, attendancesThisMonth,
  // openAttendances, stockAlerts (array), totalStockAlerts, lastUpdatedAt
  dashboard: async (): Promise<DashboardSummary> => {
    const { data } = await api.get<ApiSuccessResponse<DashboardSummary>>(
      '/reports/dashboard'
    );
    return data.data;
  },

  // Retorna array de HeatmapPointDto: weekday, hour, count, labels
  heatmap: async (params?: DateRange): Promise<HeatmapPoint[]> => {
    const { data } = await api.get<ApiSuccessResponse<HeatmapPoint[]>>(
      '/reports/heatmap',
      { params }
    );
    return data.data;
  },

  // Retorna { data: AbcCurveItemDto[], summary: { classA, classB, classC, totalDispensed } }
  medicationAbc: async (): Promise<{
    data: AbcItem[];
    summary: { classA: number; classB: number; classC: number; totalDispensed: number };
  }> => {
    const { data } = await api.get<ApiSuccessResponse<{
      data: AbcItem[];
      summary: { classA: number; classB: number; classC: number; totalDispensed: number };
    }>>('/reports/medications/abc');
    return data.data;
  },

  // Retorna AllergyCoverageDto: totalActiveStudents, studentsWithAllergies,
  // percentWithAllergies, breakdownBySeverity
  allergyCoverage: async (): Promise<AllergyCoverage> => {
    const { data } = await api.get<ApiSuccessResponse<AllergyCoverage>>(
      '/reports/allergies/coverage'
    );
    return data.data;
  },

  // Retorna array de { date: string, count: number }
  attendancesByDay: async (params?: DateRange): Promise<AttendanceByDay[]> => {
    const { data } = await api.get<ApiSuccessResponse<AttendanceByDay[]>>(
      '/reports/attendances/by-day',
      { params }
    );
    return data.data;
  },

  // Retorna array de { status, statusLabel, count, percent }
  attendancesByStatus: async (): Promise<AttendanceByStatus[]> => {
    const { data } = await api.get<ApiSuccessResponse<AttendanceByStatus[]>>(
      '/reports/attendances/by-status'
    );
    return data.data;
  },

  // Apenas superadmin — o backend valida role e retorna 403 para outros
  // Query params: performedBy, action, targetTable, startDate, endDate, page, limit
  auditLog: async (params?: {
    performedBy?: string;
    action?: string;
    targetTable?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiSuccessResponse<AuditLog[]>>(
      '/reports/audit',
      { params }
    );
    return data; // retorna com pagination
  },
};