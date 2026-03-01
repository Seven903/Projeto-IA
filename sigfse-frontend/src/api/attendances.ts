// src/api/attendances.ts
// Conecta com as rotas do backend em src/routes/attendance.routes.ts:
//   GET  /api/v1/attendances           → AttendanceController.list
//   GET  /api/v1/attendances/open      → AttendanceController.listOpen
//   POST /api/v1/attendances           → AttendanceController.open
//   GET  /api/v1/attendances/:id       → AttendanceController.getById
//   PUT  /api/v1/attendances/:id/close → AttendanceController.close

import { api } from './client';
import type {
  ApiSuccessResponse,
  Attendance,
  OpenAttendanceResponse,
} from '../types';

export const attendancesApi = {
  // Query params aceitos pelo attendanceSearchSchema do backend:
  //   studentId, attendedBy → UUIDs
  //   status    → 'open' | 'dispensed' | 'referred' | 'closed' | 'blocked_allergy'
  //   startDate, endDate → YYYY-MM-DD
  //   page, limit → inteiros positivos
  list: async (params?: {
    studentId?: string;
    attendedBy?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiSuccessResponse<Attendance[]>>(
      '/attendances',
      { params }
    );
    return data; // retorna com pagination
  },

  // GET /attendances/open — lista apenas atendimentos com status='open'
  // inclui student (id, fullName, enrollmentCode, gradeClass) e attendedByUser
  listOpen: async (): Promise<Attendance[]> => {
    const { data } = await api.get<ApiSuccessResponse<Attendance[]>>(
      '/attendances/open'
    );
    return data.data;
  },

  // GET /attendances/:id — retorna Attendance com durationMinutes e includes completos
  getById: async (id: string): Promise<Attendance> => {
    const { data } = await api.get<ApiSuccessResponse<Attendance>>(
      `/attendances/${id}`
    );
    return data.data;
  },

  // POST /attendances — campos do openAttendanceSchema do backend
  // Retorna OpenAttendanceResponse: { attendance, student, allergyAlerts }
  // allergyAlerts.hasBlockingAllergies indica se há alergias graves pré-cadastradas
  open: async (payload: {
    studentId: string;          // UUID obrigatório
    symptoms: string;           // mín 5, máx 2000 chars
    clinicalNotes?: string | null;
    temperatureC?: number | null; // 30–45°C, máx 1 casa decimal
    bloodPressure?: string | null; // formato "120/80"
  }): Promise<OpenAttendanceResponse> => {
    const { data } = await api.post<ApiSuccessResponse<OpenAttendanceResponse>>(
      '/attendances',
      payload
    );
    return data.data;
  },

  // PUT /attendances/:id/close — campos do closeAttendanceSchema do backend
  // status 'referred' exige referralDestination (validado pelo backend)
  close: async (
    id: string,
    payload: {
      status: 'referred' | 'closed';
      clinicalNotes?: string | null;
      referralDestination?: string | null; // obrigatório quando status='referred'
    }
  ): Promise<Attendance> => {
    const { data } = await api.put<ApiSuccessResponse<Attendance>>(
      `/attendances/${id}/close`,
      payload
    );
    return data.data;
  },
};