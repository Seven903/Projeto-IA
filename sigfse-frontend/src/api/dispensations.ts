// src/api/dispensations.ts
// Conecta com as rotas do backend em src/routes/dispensation.routes.ts:
//   POST /api/v1/dispensations         → DispensationController.dispense
//   POST /api/v1/dispensations/check   → DispensationController.checkAllergy
//   GET  /api/v1/dispensations/:id     → DispensationController.getById

import { api } from './client';
import type {
  ApiSuccessResponse,
  AllergyCheckResult,
  DispenseResponse,
  Dispensation,
} from '../types';

export const dispensationsApi = {
  // POST /dispensations/check — pré-verificação SEM dispensar
  // Chame ANTES do dispense para exibir alertas ao enfermeiro
  // Campos do allergyCheckSchema: studentId + batchId (ambos UUIDs)
  checkAllergy: async (payload: {
    studentId: string;
    batchId: string;
  }): Promise<AllergyCheckResult> => {
    const { data } = await api.post<ApiSuccessResponse<AllergyCheckResult>>(
      '/dispensations/check',
      payload
    );
    return data.data;
  },

  // POST /dispensations — dispensação real, auditada pelo auditLogger middleware
  // Campos do dispenseSchema do backend:
  //   attendanceId       → UUID do atendimento com status='open'
  //   batchId            → UUID do lote com estoque > 0 e não vencido
  //   quantityDispensed  → inteiro 1–100
  //   dosageInstructions → string mín 5, máx 1000 chars
  //   notes              → string máx 500 chars (opcional)
  // Retorna DispenseResponse: { dispensation, allergyCheck, remainingStock, stockAlert? }
  dispense: async (payload: {
    attendanceId: string;
    batchId: string;
    quantityDispensed: number;
    dosageInstructions: string;
    notes?: string | null;
  }): Promise<DispenseResponse> => {
    const { data } = await api.post<ApiSuccessResponse<DispenseResponse>>(
      '/dispensations',
      payload
    );
    return data.data;
  },

  // GET /dispensations/:id — retorna Dispensation com detalhes do lote e medicamento
  getById: async (id: string): Promise<Dispensation> => {
    const { data } = await api.get<ApiSuccessResponse<Dispensation>>(
      `/dispensations/${id}`
    );
    return data.data;
  },
};