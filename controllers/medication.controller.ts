// src/controllers/medication.controller.ts
// ============================================================
// Controller de medicamentos e lotes de estoque.
//
// Rotas atendidas:
//   GET  /api/v1/medications              → lista medicamentos
//   POST /api/v1/medications              → cadastra medicamento
//   GET  /api/v1/medications/:id          → detalhes + lotes
//   PUT  /api/v1/medications/:id          → atualiza medicamento
//   GET  /api/v1/medications/stock/alerts → alertas de estoque
//   POST /api/v1/medications/:id/batches  → registra entrada de lote
//   GET  /api/v1/medications/:id/batches  → lista lotes do medicamento
// ============================================================

import { Request, Response } from 'express';
import { StockService } from '../services/StockService';
import { ValidationError, UniqueConstraintError } from 'sequelize';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendValidationError,
  sendForbidden,
  sendInternalError,
  buildPagination,
} from '../utils/responseBuilder';
import { MedicationSearchQuery, IdParams } from '../types/api.types';

const stockService = new StockService();

export class MedicationController {

  // ── GET /medications ─────────────────────────────────────

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const { rows, count, page, limit } = await stockService.listMedications(
        req.query as MedicationSearchQuery
      );

      return sendSuccess(res, rows, 200, buildPagination(count, page, limit));

    } catch (error) {
      console.error('[MedicationController.list]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /medications ────────────────────────────────────

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;

      if (!operator.permissions.canManageStock) {
        return sendForbidden(
          res,
          'Apenas farmacêuticos podem cadastrar medicamentos.'
        );
      }

      const medication = await stockService.createMedication(req.body, operator);

      return sendCreated(res, medication);

    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return sendValidationError(res, 'SKU já cadastrado.');
      }
      if (error instanceof ValidationError) {
        return sendValidationError(
          res,
          error.errors.map((e) => e.message).join(' | ')
        );
      }
      console.error('[MedicationController.create]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /medications/:id ─────────────────────────────────

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as IdParams;
      const medication = await stockService.getMedicationById(id);

      if (!medication) {
        return sendNotFound(res, 'Medicamento');
      }

      // Inclui estoque total calculado
      const totalStock = await stockService.getTotalStock(id);

      return sendSuccess(res, { ...medication.toJSON(), totalStock });

    } catch (error) {
      console.error('[MedicationController.getById]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /medications/stock/alerts ────────────────────────

  async getStockAlerts(req: Request, res: Response): Promise<Response> {
    try {
      const alerts = await stockService.getStockAlerts();
      const counts = await stockService.getAlertCounts();

      return sendSuccess(res, { alerts, counts });

    } catch (error) {
      console.error('[MedicationController.getStockAlerts]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /medications/:id/batches ────────────────────────

  async receiveBatch(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;
      const { id } = req.params as IdParams;

      if (!operator.permissions.canManageStock) {
        return sendForbidden(
          res,
          'Apenas farmacêuticos podem registrar entradas de lotes.'
        );
      }

      const body = req.body;

      // Validações básicas do lote
      if (!body.batchNumber) {
        return sendValidationError(res, 'Número do lote é obrigatório.');
      }
      if (!body.expiryDate) {
        return sendValidationError(res, 'Data de validade é obrigatória.');
      }
      if (!body.quantityTotal || body.quantityTotal < 1) {
        return sendValidationError(res, 'Quantidade total deve ser maior que zero.');
      }

      // Verifica se a data de validade não está no passado
      if (new Date(body.expiryDate) < new Date()) {
        return sendValidationError(
          res,
          'Não é possível registrar lote com data de validade no passado.'
        );
      }

      const batch = await stockService.receiveBatch(
        {
          ...body,
          medicationId: id,
          quantityAvailable: body.quantityTotal, // começa com 100% disponível
        },
        operator
      );

      return sendCreated(res, batch);

    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return sendValidationError(
          res,
          'Este número de lote já está cadastrado para este medicamento.'
        );
      }
      if (error instanceof ValidationError) {
        return sendValidationError(
          res,
          error.errors.map((e) => e.message).join(' | ')
        );
      }
      console.error('[MedicationController.receiveBatch]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /medications/:id/batches ─────────────────────────

  async listBatches(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params as IdParams;
      const medication = await stockService.getMedicationById(id);

      if (!medication) {
        return sendNotFound(res, 'Medicamento');
      }

      const batches = await medication.getBatches({
        order: [['expiry_date', 'ASC']],
      });

      // Enriquece cada lote com getters computados
      const enrichedBatches = batches.map((b: any) => ({
        ...b.toJSON(),
        isExpired: b.isExpired,
        isExpiringSoon: b.isExpiringSoon,
        daysUntilExpiry: b.daysUntilExpiry,
        availabilityPercent: b.availabilityPercent,
      }));

      return sendSuccess(res, enrichedBatches);

    } catch (error) {
      console.error('[MedicationController.listBatches]', error);
      return sendInternalError(res, error);
    }
  }
}