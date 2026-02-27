// src/services/StockService.ts
// ============================================================
// Serviço de gestão de estoque farmacêutico.
//
// Responsabilidades:
//   • CRUD de medicamentos e lotes
//   • Cálculo de estoque total por medicamento
//   • Geração de alertas de estoque baixo e vencimento próximo
//   • Seleção de lote por FEFO (First Expired, First Out)
//   • Listagem de lotes disponíveis para dispensação
// ============================================================

import { Op, fn, col, literal } from 'sequelize';
import { Medication } from '../models/Medication';
import { MedicationBatch } from '../models/MedicationBatch';
import { AuditLog } from '../models/AuditLog';
import { StockAlertDto } from '../types/dispensation.types';
import { MedicationSearchQuery } from '../types/api.types';
import { normalizeIngredient } from '../utils/normalize';
import { expiryStatusLabel, isExpired, isExpiringSoon } from '../utils/dateHelpers';
import { AuthenticatedUser } from '../types/express.d';

export class StockService {

  // ── Medicamentos ─────────────────────────────────────────

  /**
   * Lista medicamentos com filtros e paginação.
   */
  async listMedications(query: MedicationSearchQuery) {
    const { page = '1', limit = '20', q, isControlled, isActive = 'true' } = query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (isActive !== 'all') {
      where.isActive = isActive !== 'false';
    }

    if (isControlled !== undefined) {
      where.isControlled = isControlled === 'true';
    }

    if (q) {
      where[Op.or as unknown as string] = [
        { commercialName: { [Op.like]: `%${q}%` } },
        { activeIngredient: { [Op.like]: `%${normalizeIngredient(q)}%` } },
        { sku: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await Medication.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['commercialName', 'ASC']],
    });

    return { rows, count, page: pageNum, limit: limitNum };
  }

  /**
   * Busca um medicamento por ID incluindo todos os lotes.
   */
  async getMedicationById(id: string): Promise<Medication | null> {
    return Medication.findByPk(id, {
      include: [
        {
          model: MedicationBatch,
          as: 'batches',
          order: [['expiry_date', 'ASC']],
        },
      ],
    });
  }

  /**
   * Cria um novo medicamento.
   * Normaliza o activeIngredient antes de persistir.
   */
  async createMedication(
    data: Omit<Medication['_creationAttributes'], 'id' | 'createdAt' | 'updatedAt'>,
    operator: AuthenticatedUser
  ): Promise<Medication> {
    const medication = await Medication.create({
      ...data,
      activeIngredient: normalizeIngredient(data.activeIngredient),
    });

    await AuditLog.create({
      performedBy: operator.id,
      action: 'STOCK_UPDATE',
      targetTable: 'medications',
      targetId: medication.id,
      payload: {
        operation: 'CREATE',
        sku: medication.sku,
        commercialName: medication.commercialName,
        activeIngredient: medication.activeIngredient,
      },
    });

    return medication;
  }

  // ── Lotes ────────────────────────────────────────────────

  /**
   * Registra a entrada de um novo lote no estoque.
   * Gera AuditLog de STOCK_UPDATE.
   */
  async receiveBatch(
    data: Omit<MedicationBatch['_creationAttributes'], 'id' | 'createdAt' | 'updatedAt'>,
    operator: AuthenticatedUser
  ): Promise<MedicationBatch> {
    const batch = await MedicationBatch.create({
      ...data,
      receivedBy: operator.id,
    });

    const medication = await Medication.findByPk(data.medicationId, {
      attributes: ['commercialName', 'sku'],
    });

    await AuditLog.create({
      performedBy: operator.id,
      action: 'STOCK_UPDATE',
      targetTable: 'medication_batches',
      targetId: batch.id,
      payload: {
        operation: 'BATCH_RECEIVED',
        medicationId: data.medicationId,
        commercialName: medication?.commercialName,
        batchNumber: batch.batchNumber,
        quantityTotal: batch.quantityTotal,
        expiryDate: batch.expiryDate,
        receivedAt: batch.receivedAt,
      },
    });

    return batch;
  }

  /**
   * Retorna o melhor lote disponível para um medicamento usando FEFO.
   * FEFO = First Expired, First Out — prioriza o lote que vence primeiro.
   *
   * @param medicationId    - UUID do medicamento
   * @param quantityNeeded  - Quantidade necessária para a dispensação
   * @returns Lote disponível ou null se não houver estoque suficiente
   */
  async getBestAvailableBatch(
    medicationId: string,
    quantityNeeded: number
  ): Promise<MedicationBatch | null> {
    return MedicationBatch.findOne({
      where: {
        medicationId,
        quantityAvailable: { [Op.gte]: quantityNeeded },
        // Não retorna lotes vencidos
        expiryDate: { [Op.gt]: new Date().toISOString().split('T')[0] },
      },
      order: [['expiry_date', 'ASC']], // FEFO
    });
  }

  /**
   * Retorna o estoque total disponível de um medicamento
   * somando todos os lotes não vencidos.
   */
  async getTotalStock(medicationId: string): Promise<number> {
    const result = await MedicationBatch.findOne({
      where: {
        medicationId,
        expiryDate: { [Op.gt]: new Date().toISOString().split('T')[0] },
      },
      attributes: [[fn('SUM', col('quantity_available')), 'total']],
      raw: true,
    });

    return (result as any)?.total ?? 0;
  }

  // ── Alertas de estoque ───────────────────────────────────

  /**
   * Retorna todos os alertas de estoque ativos:
   *   • Medicamentos com estoque total abaixo do mínimo
   *   • Lotes vencidos com estoque restante
   *   • Lotes vencendo dentro da janela de alerta
   *
   * Ordenados por alertLevel: critical → warning → info
   */
  async getStockAlerts(): Promise<StockAlertDto[]> {
    const medications = await Medication.findAll({
      where: { isActive: true },
      include: [
        {
          model: MedicationBatch,
          as: 'batches',
          where: { quantityAvailable: { [Op.gt]: 0 } },
          required: false,
          order: [['expiry_date', 'ASC']],
        },
      ],
    });

    const alerts: StockAlertDto[] = [];

    for (const medication of medications) {
      const batches = await medication.getBatches();

      // Filtra apenas lotes com estoque disponível
      const availableBatches = batches.filter(
        (b: MedicationBatch) => b.quantityAvailable > 0
      );

      const totalStock = availableBatches.reduce(
        (sum: number, b: MedicationBatch) => sum + b.quantityAvailable,
        0
      );

      const nearestBatch = availableBatches.sort(
        (a: MedicationBatch, b: MedicationBatch) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      )[0];

      const nearestExpiryDate = nearestBatch?.expiryDate ?? null;
      const hasExpiredBatch = nearestBatch ? isExpired(nearestBatch.expiryDate) : false;
      const expiringSoon = nearestBatch
        ? isExpiringSoon(nearestBatch.expiryDate, nearestBatch.alertDaysBeforeExpiry)
        : false;
      const lowStock = totalStock <= medication.minimumStockQty;

      // Só adiciona à lista se houver algum alerta
      if (!lowStock && !hasExpiredBatch && !expiringSoon) continue;

      // Determina nível de urgência
      let alertLevel: StockAlertDto['alertLevel'] = 'info';
      if (hasExpiredBatch || totalStock === 0) alertLevel = 'critical';
      else if (lowStock || expiringSoon) alertLevel = 'warning';

      alerts.push({
        medicationId: medication.id,
        sku: medication.sku,
        commercialName: medication.commercialName,
        activeIngredient: medication.activeIngredient,
        totalStock,
        minimumStockQty: medication.minimumStockQty,
        isLowStock: lowStock,
        nearestExpiryDate: nearestExpiryDate ? new Date(nearestExpiryDate) : null,
        isExpiringSoon: expiringSoon,
        hasExpiredBatch,
        expiryStatusLabel: nearestExpiryDate
          ? expiryStatusLabel(nearestExpiryDate)
          : 'Sem lotes',
        alertLevel,
      });
    }

    // Ordena: critical primeiro, depois warning, depois info
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return alerts.sort(
      (a, b) => levelOrder[a.alertLevel] - levelOrder[b.alertLevel]
    );
  }

  /**
   * Retorna a contagem de alertas por nível para o badge do dashboard.
   */
  async getAlertCounts(): Promise<{
    critical: number;
    warning: number;
    info: number;
    total: number;
  }> {
    const alerts = await this.getStockAlerts();
    const counts = { critical: 0, warning: 0, info: 0, total: alerts.length };
    for (const alert of alerts) {
      counts[alert.alertLevel]++;
    }
    return counts;
  }
}