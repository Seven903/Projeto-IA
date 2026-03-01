// src/api/medications.ts
// Conecta com as rotas do backend em src/routes/medication.routes.ts:
//   GET  /api/v1/medications                   → MedicationController.list
//   POST /api/v1/medications                   → MedicationController.create
//   GET  /api/v1/medications/stock/alerts      → MedicationController.getStockAlerts
//   GET  /api/v1/medications/:id               → MedicationController.getById
//   POST /api/v1/medications/:id/batches       → MedicationController.receiveBatch
//
// ATENÇÃO: /stock/alerts está declarada ANTES de /:id no backend (medication.routes.ts)
// para evitar que o Express interprete "stock" como UUID no parâmetro :id.

import { api } from './client';
import type {
  ApiSuccessResponse,
  Medication,
  MedicationBatch,
  StockAlertsResponse,
} from '../types';

export const medicationsApi = {
  // Query params aceitos pelo medicationSearchSchema do backend:
  //   q           → string — busca por nome, SKU ou princípio ativo
  //   isControlled → 'true' | 'false'  (string enum na query string)
  //   isActive    → 'true' | 'false' | 'all'  (padrão 'true')
  //   page, limit → inteiros positivos
  list: async (params?: {
    q?: string;
    isControlled?: 'true' | 'false'; // string, não boolean — vem na query string
    isActive?: 'true' | 'false' | 'all';
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiSuccessResponse<Medication[]>>(
      '/medications',
      { params }
    );
    return data; // retorna com pagination
  },

  // GET /medications/:id — retorna Medication + totalStock calculado pelo controller
  getById: async (id: string): Promise<Medication & { batches: MedicationBatch[] }> => {
    const { data } = await api.get<ApiSuccessResponse<Medication & { batches: MedicationBatch[] }>>(
      `/medications/${id}`
    );
    return data.data;
  },

  // POST /medications — campos do createMedicationSchema do backend
  create: async (payload: {
    sku: string;
    commercialName: string;
    activeIngredient: string;       // normalizado pelo backend com normalizeIngredient()
    dosage: string;
    pharmaceuticalForm: string;
    unitMeasure: string;
    minimumStockQty?: number;       // inteiro >= 0, padrão 10
    isControlled?: boolean;
    requiresPrescription?: boolean;
  }): Promise<Medication> => {
    const { data } = await api.post<ApiSuccessResponse<Medication>>(
      '/medications',
      payload
    );
    return data.data;
  },

  // GET /medications/stock/alerts
  // Controller retorna { alerts: StockAlertDto[], counts: { critical, warning, info, total } }
  getStockAlerts: async (): Promise<StockAlertsResponse> => {
    const { data } = await api.get<ApiSuccessResponse<StockAlertsResponse>>(
      '/medications/stock/alerts'
    );
    return data.data;
  },

  // POST /medications/:id/batches — campos do receiveBatchSchema do backend
  // expiryDate não pode ser data passada (validado pelo backend)
  // manufactureDate deve ser anterior à expiryDate
  receiveBatch: async (
    medicationId: string,
    payload: {
      batchNumber: string;          // mín 2, máx 50 chars
      manufacturer?: string | null;
      quantityTotal: number;        // inteiro positivo
      manufactureDate?: string | null; // YYYY-MM-DD, não pode ser futuro
      expiryDate: string;           // YYYY-MM-DD, obrigatório, deve ser futuro
      alertDaysBeforeExpiry?: number; // inteiro 1-365, padrão 30
      notes?: string | null;
    }
  ): Promise<MedicationBatch> => {
    const { data } = await api.post<ApiSuccessResponse<MedicationBatch>>(
      `/medications/${medicationId}/batches`,
      payload
    );
    return data.data;
  },
};