// src/services/ReportService.ts
// ============================================================
// Serviço de Business Intelligence — relatórios e estatísticas.
//
// Todos os dados retornados por este serviço são ANONIMIZADOS.
// Nenhuma consulta retorna nome de aluno, matrícula ou qualquer
// dado pessoal identificável. Isso permite que o role 'admin'
// acesse este serviço sem violar a separação de dados da LGPD.
//
// Relatórios disponíveis:
//   1. Dashboard Summary   → contadores do dia para a tela inicial
//   2. Heatmap             → frequência de atendimentos por dia/hora
//   3. Curva ABC           → ranking Pareto de medicamentos consumidos
//   4. Cobertura de Alergias → percentual da comunidade com alergias mapeadas
// ============================================================

import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection';
import { Attendance } from '../models/Attendance';
import { Dispensation } from '../models/Dispensation';
import { MedicationBatch } from '../models/MedicationBatch';
import { Medication } from '../models/Medication';
import { Student } from '../models/Student';
import { StudentAllergy } from '../models/StudentAllergy';
import { AuditLog } from '../models/AuditLog';
import {
  HeatmapPointDto,
  AbcCurveItemDto,
  AllergyCoverageDto,
  DashboardSummaryDto,
} from '../types/dispensation.types';
import { StockService } from './StockService';
import { getDateRange, parseDateRangeFromQuery, generateWeekdayLabels, generateHourLabels } from '../utils/dateHelpers';
import { AuthenticatedUser } from '../types/express.d';

export class ReportService {
  private stockService: StockService;

  constructor() {
    this.stockService = new StockService();
  }

  // ── Dashboard Summary ────────────────────────────────────

  /**
   * Retorna os dados resumidos para a tela inicial (dashboard) do enfermeiro.
   * Inclui atendimentos do dia, do mês e alertas de estoque ativos.
   */
  async getDashboardSummary(operator: AuthenticatedUser): Promise<DashboardSummaryDto> {
    const { start: startToday, end: endToday } = getDateRange('today');
    const { start: startMonth, end: endMonth } = getDateRange('thisMonth');

    const [
      attendancesToday,
      attendancesThisMonth,
      openAttendances,
      stockAlerts,
    ] = await Promise.all([
      // Atendimentos hoje
      Attendance.count({
        where: {
          attendedAt: { [Op.between]: [startToday, endToday] },
        },
      }),

      // Atendimentos no mês
      Attendance.count({
        where: {
          attendedAt: { [Op.between]: [startMonth, endMonth] },
        },
      }),

      // Atendimentos em aberto agora
      Attendance.count({
        where: { status: 'open' },
      }),

      // Alertas de estoque
      this.stockService.getStockAlerts(),
    ]);

    // Registra geração de relatório no AuditLog
    await AuditLog.create({
      performedBy: operator.id,
      action: 'REPORT_GENERATED',
      targetTable: null,
      targetId: null,
      payload: {
        reportType: 'DASHBOARD_SUMMARY',
        generatedAt: new Date().toISOString(),
      },
    });

    return {
      attendancesToday,
      attendancesThisMonth,
      openAttendances,
      stockAlerts,
      totalStockAlerts: stockAlerts.length,
      lastUpdatedAt: new Date(),
    };
  }

  // ── Heatmap de frequência de atendimentos ────────────────

  /**
   * Gera o heatmap de frequência de visitas à enfermaria.
   *
   * Estrutura do retorno:
   *   Matriz 7 (dias da semana) × 24 (horas do dia)
   *   Cada célula contém o número de atendimentos naquele slot.
   *
   * Uso previsto:
   *   Identificar padrões de pico (ex: segunda-feira às 10h)
   *   para prever surtos e alocar recursos preventivamente.
   *
   * @param startDate - Início do período (YYYY-MM-DD) — padrão: mês atual
   * @param endDate   - Fim do período (YYYY-MM-DD) — padrão: mês atual
   */
  async getAttendanceHeatmap(
    startDate?: string,
    endDate?: string
  ): Promise<HeatmapPointDto[]> {
    const { start, end } = parseDateRangeFromQuery(startDate, endDate);

    // SQLite não tem EXTRACT diretamente no Sequelize — usamos query raw
    const rows = await sequelize.query<{
      weekday: number;
      hour: number;
      count: number;
    }>(
      `SELECT
        CAST(strftime('%w', attended_at) AS INTEGER) AS weekday,
        CAST(strftime('%H', attended_at) AS INTEGER) AS hour,
        COUNT(*) AS count
       FROM attendances
       WHERE attended_at BETWEEN :start AND :end
       GROUP BY weekday, hour
       ORDER BY weekday, hour`,
      {
        replacements: { start: start.toISOString(), end: end.toISOString() },
        type: QueryTypes.SELECT,
      }
    );

    const weekdayLabels = generateWeekdayLabels();
    const hourLabels = generateHourLabels();

    // Constrói a matriz completa — slots sem atendimentos ficam com count=0
    const heatmap: HeatmapPointDto[] = [];

    for (let weekday = 0; weekday < 7; weekday++) {
      for (let hour = 0; hour < 24; hour++) {
        const found = rows.find(
          (r) => r.weekday === weekday && r.hour === hour
        );
        heatmap.push({
          weekday,
          weekdayLabel: weekdayLabels[weekday],
          hour,
          hourLabel: hourLabels[hour],
          count: found?.count ?? 0,
        });
      }
    }

    return heatmap;
  }

  // ── Curva ABC ────────────────────────────────────────────

  /**
   * Gera a curva ABC de Pareto dos medicamentos mais consumidos.
   *
   * Classificação:
   *   Classe A → acumulado ≤ 80%  (poucos medicamentos, alto volume)
   *   Classe B → acumulado ≤ 95%  (medicamentos intermediários)
   *   Classe C → acumulado > 95%  (muitos medicamentos, baixo volume)
   *
   * Insight esperado:
   *   ~20% dos medicamentos representam ~80% das dispensações (lei de Pareto).
   *   Ex: analgésicos, antitérmicos e antiespasmódicos tendem a ser classe A.
   *
   * @param startDate - Início do período — padrão: ano atual
   * @param endDate   - Fim do período — padrão: ano atual
   */
  async getMedicationAbcCurve(
    startDate?: string,
    endDate?: string
  ): Promise<AbcCurveItemDto[]> {
    const { start, end } = parseDateRangeFromQuery(
      startDate,
      endDate ?? undefined
    ) ?? getDateRange('thisYear');

    // Query raw para aproveitar window functions do SQLite (3.25+)
    const rows = await sequelize.query<{
      medication_id: string;
      commercial_name: string;
      active_ingredient: string;
      pharmaceutical_form: string;
      total_dispensed: number;
      total_events: number;
    }>(
      `SELECT
        m.id           AS medication_id,
        m.commercial_name,
        m.active_ingredient,
        m.pharmaceutical_form,
        SUM(d.quantity_dispensed) AS total_dispensed,
        COUNT(d.id)               AS total_events
       FROM dispensations d
       JOIN medication_batches mb ON d.batch_id = mb.id
       JOIN medications m         ON mb.medication_id = m.id
       WHERE d.dispensed_at BETWEEN :start AND :end
       GROUP BY m.id, m.commercial_name, m.active_ingredient, m.pharmaceutical_form
       ORDER BY total_dispensed DESC`,
      {
        replacements: { start: start.toISOString(), end: end.toISOString() },
        type: QueryTypes.SELECT,
      }
    );

    if (rows.length === 0) return [];

    // Calcula totais e curva acumulada
    const grandTotal = rows.reduce((sum, r) => sum + r.total_dispensed, 0);

    let cumulative = 0;

    return rows.map((row, index) => {
      cumulative += row.total_dispensed;
      const pct = (row.total_dispensed / grandTotal) * 100;
      const cumulativePct = (cumulative / grandTotal) * 100;

      let abcClass: 'A' | 'B' | 'C';
      if (cumulativePct <= 80) abcClass = 'A';
      else if (cumulativePct <= 95) abcClass = 'B';
      else abcClass = 'C';

      return {
        rank: index + 1,
        medicationId: row.medication_id,
        commercialName: row.commercial_name,
        activeIngredient: row.active_ingredient,
        pharmaceuticalForm: row.pharmaceutical_form,
        totalDispensed: row.total_dispensed,
        totalEvents: row.total_events,
        percentOfTotal: Math.round(pct * 100) / 100,
        cumulativePercent: Math.round(cumulativePct * 100) / 100,
        abcClass,
      };
    });
  }

  // ── Cobertura de alergias ────────────────────────────────

  /**
   * Retorna o percentual da comunidade discente com alergias mapeadas
   * e o detalhamento por severidade.
   *
   * Usado para identificar gaps no mapeamento de saúde:
   *   Se < 50% dos alunos têm alergias registradas, provavelmente
   *   o cadastro está incompleto, não que metade seja livre de alergias.
   */
  async getAllergyCoverage(): Promise<AllergyCoverageDto> {
    const [
      totalActiveStudents,
      studentsWithAllergies,
      anaphylacticCount,
      severeCount,
      moderateCount,
      mildCount,
    ] = await Promise.all([
      Student.count({ where: { isActive: true } }),

      // Conta alunos distintos com pelo menos uma alergia
      StudentAllergy.count({
        distinct: true,
        col: 'studentId',
      }),

      StudentAllergy.count({ where: { severity: 'anaphylactic' } }),
      StudentAllergy.count({ where: { severity: 'severe' } }),
      StudentAllergy.count({ where: { severity: 'moderate' } }),
      StudentAllergy.count({ where: { severity: 'mild' } }),
    ]);

    const percentWithAllergies =
      totalActiveStudents > 0
        ? Math.round((studentsWithAllergies / totalActiveStudents) * 10000) / 100
        : 0;

    return {
      totalActiveStudents,
      studentsWithAllergies,
      percentWithAllergies,
      breakdownBySeverity: {
        anaphylactic: anaphylacticCount,
        severe: severeCount,
        moderate: moderateCount,
        mild: mildCount,
      },
    };
  }

  // ── Relatório de atendimentos por período ────────────────

  /**
   * Retorna a contagem de atendimentos agrupados por dia.
   * Usado para gráfico de linha/barras no painel de estatísticas.
   */
  async getAttendancesByDay(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ date: string; count: number }>> {
    const { start, end } = parseDateRangeFromQuery(startDate, endDate);

    const rows = await sequelize.query<{ date: string; count: number }>(
      `SELECT
        DATE(attended_at) AS date,
        COUNT(*)          AS count
       FROM attendances
       WHERE attended_at BETWEEN :start AND :end
       GROUP BY DATE(attended_at)
       ORDER BY date ASC`,
      {
        replacements: { start: start.toISOString(), end: end.toISOString() },
        type: QueryTypes.SELECT,
      }
    );

    return rows;
  }

  /**
   * Retorna os atendimentos por status no período.
   * Útil para medir taxa de encaminhamentos e bloqueios por alergia.
   */
  async getAttendancesByStatus(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ status: string; count: number }>> {
    const { start, end } = parseDateRangeFromQuery(startDate, endDate);

    const rows = await sequelize.query<{ status: string; count: number }>(
      `SELECT
        status,
        COUNT(*) AS count
       FROM attendances
       WHERE attended_at BETWEEN :start AND :end
       GROUP BY status
       ORDER BY count DESC`,
      {
        replacements: { start: start.toISOString(), end: end.toISOString() },
        type: QueryTypes.SELECT,
      }
    );

    return rows;
  }
}