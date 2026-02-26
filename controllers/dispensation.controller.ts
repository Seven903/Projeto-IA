// src/controllers/dispensation.controller.ts
// ============================================================
// Controller de dispensação de medicamentos.
//
// Rotas atendidas:
//   POST /api/v1/dispensations              → realiza dispensação (com cross-check)
//   GET  /api/v1/dispensations/:id          → detalhes de uma dispensação
//   GET  /api/v1/dispensations/check-allergy → pré-verifica alergia sem dispensar
//
// Este controller é o ponto de entrada da operação mais crítica
// do sistema. Toda lógica de negócio é delegada ao DispensationService.
//
// Fluxo da rota POST /dispensations:
//   Controller → DispensationService → AllergyCheckService
//                                    → (se safe) Escrita atômica
//                                    → AuditLog
// ============================================================

import { Request, Response } from 'express';
import { DispensationService } from '../src/services/DispensationService';
import { AllergyCheckService } from '../src/services/AllergyCheckService';
import { Dispensation } from '../src/models/Dispensation';
import { MedicationBatch } from '../src/models/MedicationBatch';
import { Medication } from '../src/models/Medication';
import { SystemUser } from '../src/models/SystemUser';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendValidationError,
  sendForbidden,
  sendAllergyConflict,
  sendStockInsufficient,
  sendInternalError,
} from '../src/utils/responseBuilder';
import { DispensationRequestDto } from '../src/types/dispensation.types';

const dispensationService = new DispensationService();
const allergyCheckService = new AllergyCheckService();

export class DispensationController {

  // ── POST /dispensations ──────────────────────────────────

  async dispense(req: Request, res: Response): Promise<Response> {
    try {
      const operator = req.user!;

      // ── Verifica permissão ────────────────────────────────
      if (!operator.permissions.canDispense) {
        return sendForbidden(
          res,
          'Apenas enfermeiros e farmacêuticos podem dispensar medicamentos.'
        );
      }

      const body = req.body as DispensationRequestDto;

      // ── Validação de campos obrigatórios ──────────────────
      if (!body.attendanceId) {
        return sendValidationError(res, 'ID do atendimento é obrigatório.');
      }
      if (!body.batchId) {
        return sendValidationError(res, 'ID do lote é obrigatório.');
      }
      if (!body.quantityDispensed || body.quantityDispensed < 1) {
        return sendValidationError(
          res,
          'Quantidade dispensada deve ser pelo menos 1.'
        );
      }
      if (!body.dosageInstructions || body.dosageInstructions.trim().length < 5) {
        return sendValidationError(
          res,
          'Instruções de posologia são obrigatórias (mínimo 5 caracteres).'
        );
      }

      // ── Delega toda a lógica ao DispensationService ───────
      const result = await dispensationService.dispense(body, operator);

      // ── Trata resultado ───────────────────────────────────

      // CASO 1: Bloqueado por alergia
      if (!result.success && result.failureReason === 'ALLERGY_BLOCKED') {
        const conflict = result.allergyCheck.mostSevereConflict!;

        return sendAllergyConflict(res, {
          studentName: result.allergyCheck.studentName,
          allergenName: conflict.allergenName,
          activeIngredient: conflict.activeIngredient,
          severity: conflict.severity,
          reactionDescription: conflict.reactionDescription,
        });
      }

      // CASO 2: Estoque insuficiente
      if (!result.success && result.failureReason === 'STOCK_INSUFFICIENT') {
        return sendStockInsufficient(
          res,
          body.quantityDispensed,
          0, // Detalhes já no result
          'medicamento solicitado'
        );
      }

      // CASO 3: Lote vencido
      if (!result.success && result.failureReason === 'BATCH_EXPIRED') {
        return sendValidationError(
          res,
          'O lote selecionado está vencido e não pode ser utilizado para dispensação.'
        );
      }

      // CASO 4: Atendimento fechado
      if (!result.success && result.failureReason === 'ATTENDANCE_CLOSED') {
        return sendValidationError(
          res,
          'Não é possível dispensar em um atendimento já encerrado.'
        );
      }

      // CASO 5: Outros erros
      if (!result.success) {
        return sendInternalError(res, result);
      }

      // CASO 6: Sucesso — monta resposta completa
      const responseData: Record<string, unknown> = {
        dispensation: result.dispensation,
        allergyCheck: {
          safe: result.allergyCheck.safe,
          conflictsFound: result.allergyCheck.conflicts.length,
          // Inclui avisos de alergias leves/moderadas mesmo na dispensação aprovada
          warnings: result.allergyCheck.hasWarningOnly
            ? result.allergyCheck.conflicts
            : [],
        },
        remainingStock: result.remainingStock,
      };

      // Inclui alerta de estoque se o nível ficou crítico após a dispensação
      if (result.stockAlert) {
        responseData.stockAlert = result.stockAlert;
      }

      return sendCreated(res, responseData);

    } catch (error) {
      console.error('[DispensationController.dispense]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /dispensations/:id ───────────────────────────────

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const dispensation = await Dispensation.findByPk(id, {
        include: [
          {
            model: MedicationBatch,
            as: 'batch',
            include: [
              {
                model: Medication,
                as: 'medication',
                attributes: [
                  'id', 'commercialName', 'activeIngredient',
                  'dosage', 'pharmaceuticalForm',
                ],
              },
            ],
          },
          {
            model: SystemUser,
            as: 'dispensedByUser',
            attributes: ['id', 'fullName', 'role'],
          },
        ],
      });

      if (!dispensation) {
        return sendNotFound(res, 'Dispensação');
      }

      return sendSuccess(res, dispensation);

    } catch (error) {
      console.error('[DispensationController.getById]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /dispensations/check-allergy ────────────────────
  // Pré-verificação de alergia sem realizar a dispensação.
  // Usado pelo frontend para exibir alertas em tempo real
  // enquanto o enfermeiro seleciona o medicamento.

  async checkAllergy(req: Request, res: Response): Promise<Response> {
    try {
      const { studentId, batchId } = req.query as {
        studentId?: string;
        batchId?: string;
      };

      if (!studentId || !batchId) {
        return sendValidationError(
          res,
          'Os parâmetros studentId e batchId são obrigatórios.'
        );
      }

      const result = await allergyCheckService.check(studentId, batchId);

      return sendSuccess(res, {
        safe: result.safe,
        hasBlockingConflict: result.hasBlockingConflict,
        hasWarningOnly: result.hasWarningOnly,
        conflicts: result.conflicts,
        mostSevereConflict: result.mostSevereConflict,
        studentName: result.studentName,
        medicationName: result.medicationName,
        activeIngredientChecked: result.activeIngredientChecked,
        // Mensagem de bloqueio pré-formatada para exibição direta na UI
        blockMessage: result.hasBlockingConflict
          ? allergyCheckService.buildBlockMessage(result)
          : null,
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrado')) {
        return sendNotFound(res, 'Estudante ou lote');
      }
      console.error('[DispensationController.checkAllergy]', error);
      return sendInternalError(res, error);
    }
  }
}