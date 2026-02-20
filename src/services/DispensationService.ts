// src/services/DispensationService.ts
// ============================================================
// Serviço de dispensação — orquestra todo o fluxo de atendimento.
//
// Responsabilidades:
//   1. Validar pré-condições (atendimento aberto, lote disponível)
//   2. Acionar o AllergyCheckService (cross-check de segurança)
//   3. Bloquear ou prosseguir com base no resultado do check
//   4. Decrementar o estoque do lote (dentro de uma transaction)
//   5. Registrar a dispensação e atualizar o status do atendimento
//   6. Gravar o AuditLog (sucesso ou bloqueio)
//   7. Verificar se o estoque ficou abaixo do mínimo após a dispensação
//
// Princípio de atomicidade:
//   As etapas 4, 5 e 6 ocorrem dentro de uma única transaction do
//   Sequelize. Se qualquer etapa falhar, tudo é revertido (rollback)
//   e nenhum estado inconsistente é persistido.
// ============================================================

import { Transaction } from 'sequelize';
import { sequelize } from '../database/connection';
import { Attendance } from '../models/Attendance';
import { MedicationBatch } from '../models/MedicationBatch';
import { Medication } from '../models/Medication';
import { Dispensation } from '../models/Dispensation';
import { AuditLog } from '../models/AuditLog';
import { Student } from '../models/Student';
import { AllergyCheckService } from './AllergyCheckService';
import {
  DispensationRequestDto,
  DispensationResult,
  StockAlertDto,
} from '../types/dispensation.types';
import { AuthenticatedUser } from '../types/express.d';
import { expiryStatusLabel } from '../utils/dateHelpers';
import { v4 as uuidv4 } from 'uuid';

export class DispensationService {
  private allergyCheckService: AllergyCheckService;

  constructor() {
    this.allergyCheckService = new AllergyCheckService();
  }

  // ── Método principal ─────────────────────────────────────

  /**
   * Processa uma solicitação de dispensação de medicamento.
   *
   * Fluxo completo:
   *   PRÉ-VALIDAÇÃO (fora da transaction — leitura apenas)
   *     → valida atendimento aberto
   *     → valida lote disponível e não vencido
   *     → executa cross-check de alergia
   *     → se bloqueante: registra AuditLog e retorna falha
   *
   *   OPERAÇÃO (dentro de transaction — escrita atômica)
   *     → cria Dispensation
   *     → decrementa MedicationBatch.quantityAvailable
   *     → atualiza Attendance.status para 'dispensed'
   *     → registra AuditLog de DISPENSE_SUCCESS
   *
   * @param dto      - Dados da dispensação (attendanceId, batchId, quantidade)
   * @param operator - Usuário autenticado que está realizando a dispensação
   * @returns DispensationResult com sucesso ou falha detalhada
   */
  async dispense(
    dto: DispensationRequestDto,
    operator: AuthenticatedUser
  ): Promise<DispensationResult> {

    // ── ETAPA 1: Valida atendimento ─────────────────────────
    const attendance = await Attendance.findByPk(dto.attendanceId, {
      include: [{ model: Student, as: 'student', attributes: ['id', 'fullName'] }],
    });

    if (!attendance) {
      return this.buildFailure('INTERNAL_ERROR', {
        safe: false,
        conflicts: [],
        hasBlockingConflict: false,
        hasWarningOnly: false,
        mostSevereConflict: null,
        studentName: 'Desconhecido',
        medicationName: 'Desconhecido',
        activeIngredientChecked: '',
      }, `Atendimento "${dto.attendanceId}" não encontrado.`);
    }

    if (attendance.status !== 'open') {
      return this.buildFailure('ATTENDANCE_CLOSED', {
        safe: true,
        conflicts: [],
        hasBlockingConflict: false,
        hasWarningOnly: false,
        mostSevereConflict: null,
        studentName: '',
        medicationName: '',
        activeIngredientChecked: '',
      }, `Atendimento já encerrado com status "${attendance.status}".`);
    }

    // ── ETAPA 2: Valida lote ────────────────────────────────
    const batch = await MedicationBatch.findByPk(dto.batchId, {
      include: [{ model: Medication, as: 'medication' }],
    });

    if (!batch) {
      return this.buildFailure('INTERNAL_ERROR', {
        safe: true,
        conflicts: [],
        hasBlockingConflict: false,
        hasWarningOnly: false,
        mostSevereConflict: null,
        studentName: '',
        medicationName: '',
        activeIngredientChecked: '',
      }, `Lote "${dto.batchId}" não encontrado.`);
    }

    if (batch.isExpired) {
      return this.buildFailure('BATCH_EXPIRED', {
        safe: true,
        conflicts: [],
        hasBlockingConflict: false,
        hasWarningOnly: false,
        mostSevereConflict: null,
        studentName: '',
        medicationName: batch.getMedication ? (await batch.getMedication()).commercialName : '',
        activeIngredientChecked: '',
      }, `Lote "${batch.batchNumber}" está vencido desde ${batch.expiryDate}.`);
    }

    if (!batch.canDispense(dto.quantityDispensed)) {
      const medication = await batch.getMedication();
      return this.buildFailure('STOCK_INSUFFICIENT', {
        safe: true,
        conflicts: [],
        hasBlockingConflict: false,
        hasWarningOnly: false,
        mostSevereConflict: null,
        studentName: '',
        medicationName: medication.commercialName,
        activeIngredientChecked: '',
      }, `Estoque insuficiente. Disponível: ${batch.quantityAvailable}, Solicitado: ${dto.quantityDispensed}.`);
    }

    // ── ETAPA 3: Cross-check de alergia ─────────────────────
    // Esta é a trava de segurança — executa ANTES de qualquer escrita
    const allergyCheck = await this.allergyCheckService.check(
      attendance.studentId,
      dto.batchId
    );

    // ── ETAPA 3a: Bloqueia se conflito grave ────────────────
    if (allergyCheck.hasBlockingConflict) {
      // Atualiza status do atendimento para blocked_allergy
      await attendance.update({ status: 'blocked_allergy' });

      // Registra o bloqueio no log de auditoria
      await AuditLog.create({
        performedBy: operator.id,
        action: 'DISPENSE_BLOCKED_ALLERGY',
        targetTable: 'attendances',
        targetId: attendance.id,
        payload: {
          studentId: attendance.studentId,
          studentName: allergyCheck.studentName,
          medicationName: allergyCheck.medicationName,
          activeIngredient: allergyCheck.activeIngredientChecked,
          batchId: dto.batchId,
          conflicts: allergyCheck.conflicts.map((c) => ({
            allergenName: c.allergenName,
            severity: c.severity,
            reactionDescription: c.reactionDescription,
          })),
          mostSevereConflict: allergyCheck.mostSevereConflict,
          blockedAt: new Date().toISOString(),
        },
      });

      return {
        success: false,
        failureReason: 'ALLERGY_BLOCKED',
        allergyCheck,
      };
    }

    // ── ETAPA 4: Operação atômica (transaction) ─────────────
    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const medication = await batch.getMedication();
      const dispensationId = uuidv4();

      // 4a. Cria o registro de dispensação
      const dispensation = await Dispensation.create(
        {
          id: dispensationId,
          attendanceId: dto.attendanceId,
          batchId: dto.batchId,
          dispensedBy: operator.id,
          quantityDispensed: dto.quantityDispensed,
          dosageInstructions: dto.dosageInstructions,
          allergyCheckPassed: true,
          notes: dto.notes ?? null,
        },
        { transaction }
      );

      // 4b. Decrementa o estoque do lote
      const newQty = batch.quantityAvailable - dto.quantityDispensed;
      await batch.update(
        { quantityAvailable: newQty },
        { transaction }
      );

      // 4c. Atualiza status do atendimento
      await attendance.update(
        { status: 'dispensed', closedAt: new Date() },
        { transaction }
      );

      // 4d. Registra AuditLog de sucesso
      await AuditLog.create(
        {
          performedBy: operator.id,
          action: 'DISPENSE_SUCCESS',
          targetTable: 'dispensations',
          targetId: dispensationId,
          payload: {
            studentId: attendance.studentId,
            studentName: allergyCheck.studentName,
            attendanceId: dto.attendanceId,
            medicationName: medication.commercialName,
            activeIngredient: medication.activeIngredient,
            batchNumber: batch.batchNumber,
            quantityDispensed: dto.quantityDispensed,
            remainingStock: newQty,
            allergyCheckPassed: true,
            allergyConflicts: allergyCheck.conflicts,
            dispensedAt: new Date().toISOString(),
          },
        },
        { transaction }
      );

      // Confirma a transaction
      await transaction.commit();

      // ── ETAPA 5: Verifica alerta de estoque pós-dispensação ─
      const stockAlert = await this.checkStockAlert(batch, medication, newQty);

      return {
        success: true,
        allergyCheck,
        dispensation: {
          id: dispensationId,
          attendanceId: dto.attendanceId,
          batchId: dto.batchId,
          medicationName: medication.commercialName,
          activeIngredient: medication.activeIngredient,
          quantityDispensed: dto.quantityDispensed,
          dosageInstructions: dto.dosageInstructions,
          dispensedBy: operator.fullName,
          dispensedAt: dispensation.dispensedAt!,
        },
        remainingStock: newQty,
        ...(stockAlert && { stockAlert }),
      };

    } catch (error) {
      // Reverte tudo se qualquer etapa falhar
      await transaction.rollback();
      throw error;
    }
  }

  // ── Métodos auxiliares ───────────────────────────────────

  /**
   * Verifica se o estoque ficou abaixo do mínimo após a dispensação.
   * Retorna StockAlertDto se houver alerta, null caso contrário.
   */
  private async checkStockAlert(
    batch: MedicationBatch,
    medication: Medication,
    newQty: number
  ): Promise<StockAlertDto | null> {
    if (newQty > medication.minimumStockQty) return null;

    const isExpiringSoon = batch.isExpiringSoon;
    const isExpired = batch.isExpired;

    return {
      medicationId: medication.id,
      sku: medication.sku,
      commercialName: medication.commercialName,
      activeIngredient: medication.activeIngredient,
      totalStock: newQty,
      minimumStockQty: medication.minimumStockQty,
      isLowStock: true,
      nearestExpiryDate: batch.expiryDate,
      isExpiringSoon,
      hasExpiredBatch: isExpired,
      expiryStatusLabel: expiryStatusLabel(batch.expiryDate),
      alertLevel: isExpired || newQty === 0 ? 'critical' : isExpiringSoon ? 'warning' : 'info',
    };
  }

  /**
   * Constrói um DispensationResult de falha.
   */
  private buildFailure(
    reason: DispensationResult['failureReason'],
    allergyCheck: DispensationResult['allergyCheck'],
    _errorMessage?: string
  ): DispensationResult {
    return {
      success: false,
      failureReason: reason,
      allergyCheck,
    };
  }
}