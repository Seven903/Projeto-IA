// src/services/AllergyCheckService.ts
// ============================================================
// Serviço de cross-check farmacológico — trava de segurança central.
//
// Responsabilidade única:
//   Dado um estudante e um medicamento, verificar se o princípio
//   ativo do medicamento conflita com qualquer alergia cadastrada
//   para o estudante e retornar um resultado estruturado.
//
// Lógica de severidade:
//   anaphylactic → hasBlockingConflict = true  (bloqueio absoluto)
//   severe       → hasBlockingConflict = true  (bloqueio com justificativa)
//   moderate     → hasWarningOnly = true       (alerta + confirmação)
//   mild         → hasWarningOnly = true       (aviso informativo)
//
// Garantia de consistência:
//   A comparação SEMPRE usa normalizeIngredient() em ambos os lados,
//   garantindo que "Dipirona Sódica" == "dipirona sodica" == "DIPIRONA".
//
// Este serviço é chamado pelo DispensationService ANTES de qualquer
// escrita no banco. Se retornar hasBlockingConflict=true, a operação
// é abortada e um AuditLog de DISPENSE_BLOCKED_ALLERGY é gerado.
// ============================================================

import { Student } from '../models/Student';
import { StudentAllergy } from '../models/StudentAllergy';
import { Medication } from '../models/Medication';
import { MedicationBatch } from '../models/MedicationBatch';
import {
  AllergyCheckResult,
  AllergyConflict,
} from '../types/dispensation.types';
import { normalizeIngredient } from '../utils/normalize';

export class AllergyCheckService {
  // ── Método principal ─────────────────────────────────────

  /**
   * Executa o cross-check de alergia entre um estudante e um lote
   * de medicamento. Este é o caminho crítico de segurança do sistema.
   *
   * Fluxo:
   *   1. Carrega os dados do estudante e do medicamento via batchId
   *   2. Busca todas as alergias cadastradas para o estudante
   *   3. Normaliza o activeIngredient do medicamento
   *   4. Compara com cada alergia normalizada
   *   5. Classifica os conflitos por severidade
   *   6. Retorna AllergyCheckResult estruturado
   *
   * @param studentId - UUID do estudante
   * @param batchId   - UUID do lote a ser dispensado
   * @returns AllergyCheckResult com todos os conflitos encontrados
   * @throws Error se estudante ou medicamento não forem encontrados
   */
  async check(studentId: string, batchId: string): Promise<AllergyCheckResult> {
    // ── 1. Carrega estudante ────────────────────────────────
    const student = await Student.findByPk(studentId, {
      attributes: ['id', 'fullName'],
    });

    if (!student) {
      throw new Error(`Estudante com ID "${studentId}" não encontrado.`);
    }

    // ── 2. Carrega lote com medicamento associado ───────────
    const batch = await MedicationBatch.findByPk(batchId, {
      include: [
        {
          model: Medication,
          as: 'medication',
          attributes: ['id', 'commercialName', 'activeIngredient'],
        },
      ],
    });

    if (!batch) {
      throw new Error(`Lote com ID "${batchId}" não encontrado.`);
    }

    const medication = await batch.getMedication();

    if (!medication) {
      throw new Error(`Medicamento associado ao lote "${batchId}" não encontrado.`);
    }

    // ── 3. Normaliza o princípio ativo do medicamento ───────
    const normalizedActiveIngredient = normalizeIngredient(
      medication.activeIngredient
    );

    // ── 4. Busca alergias do estudante ──────────────────────
    // Índice composto (student_id, active_ingredient) garante performance O(log n)
    const allergies = await StudentAllergy.findAll({
      where: { studentId },
      attributes: [
        'id',
        'allergenName',
        'activeIngredient',
        'severity',
        'reactionDescription',
        'diagnosedBy',
      ],
    });

    // ── 5. Detecta conflitos por comparação normalizada ─────
    const conflicts: AllergyConflict[] = [];

    for (const allergy of allergies) {
      const normalizedAllergyIngredient = normalizeIngredient(
        allergy.activeIngredient
      );

      if (normalizedActiveIngredient === normalizedAllergyIngredient) {
        conflicts.push({
          allergyId: allergy.id,
          allergenName: allergy.allergenName,
          activeIngredient: allergy.activeIngredient,
          severity: allergy.severity,
          reactionDescription: allergy.reactionDescription ?? null,
          diagnosedBy: allergy.diagnosedBy ?? null,
        });
      }
    }

    // ── 6. Classifica os conflitos ──────────────────────────
    const hasBlockingConflict = conflicts.some(
      (c) => c.severity === 'anaphylactic' || c.severity === 'severe'
    );

    const hasWarningOnly =
      conflicts.length > 0 &&
      conflicts.every(
        (c) => c.severity === 'mild' || c.severity === 'moderate'
      );

    // Ordena conflitos do mais grave para o menos grave
    const severityOrder: Record<string, number> = {
      anaphylactic: 4,
      severe: 3,
      moderate: 2,
      mild: 1,
    };

    conflicts.sort(
      (a, b) =>
        (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0)
    );

    const mostSevereConflict = conflicts[0] ?? null;

    return {
      safe: conflicts.length === 0,
      conflicts,
      hasBlockingConflict,
      hasWarningOnly,
      mostSevereConflict,
      studentName: student.fullName,
      medicationName: medication.commercialName,
      activeIngredientChecked: normalizedActiveIngredient,
    };
  }

  // ── Métodos auxiliares ───────────────────────────────────

  /**
   * Verifica rapidamente se um estudante tem QUALQUER alergia bloqueante.
   * Versão otimizada para pré-validação na abertura de atendimento.
   *
   * @param studentId - UUID do estudante
   * @returns Lista de alergias bloqueantes (anaphylactic ou severe)
   */
  async getBlockingAllergies(
    studentId: string
  ): Promise<StudentAllergy[]> {
    return StudentAllergy.findAll({
      where: {
        studentId,
        severity: ['anaphylactic', 'severe'],
      },
      attributes: [
        'id',
        'allergenName',
        'activeIngredient',
        'severity',
        'reactionDescription',
      ],
    });
  }

  /**
   * Retorna todas as alergias de um estudante ordenadas por severidade.
   * Usado para exibir o painel de alergias no prontuário.
   *
   * @param studentId - UUID do estudante
   * @returns Alergias ordenadas: anaphylactic → severe → moderate → mild
   */
  async getAllergyProfile(studentId: string): Promise<StudentAllergy[]> {
    const allergies = await StudentAllergy.findAll({
      where: { studentId },
      order: [
        // Ordenação manual por severidade — SQLite não suporta CASE em ORDER BY via Sequelize
        ['createdAt', 'ASC'],
      ],
    });

    const severityOrder: Record<string, number> = {
      anaphylactic: 4,
      severe: 3,
      moderate: 2,
      mild: 1,
    };

    return allergies.sort(
      (a, b) =>
        (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0)
    );
  }

  /**
   * Monta a mensagem de bloqueio exibida ao enfermeiro na tela.
   *
   * @param result - Resultado do cross-check
   * @returns Mensagem formatada para exibição
   */
  buildBlockMessage(result: AllergyCheckResult): string {
    const { mostSevereConflict, studentName, medicationName } = result;

    if (!mostSevereConflict) return '';

    const severityLabel =
      mostSevereConflict.severity === 'anaphylactic'
        ? '🚨 ANAFILÁTICA'
        : '⚠️ SEVERA';

    let message =
      `DISPENSAÇÃO BLOQUEADA\n\n` +
      `Paciente: ${studentName}\n` +
      `Medicamento: ${medicationName}\n` +
      `Princípio ativo: ${mostSevereConflict.activeIngredient}\n\n` +
      `Alergia ${severityLabel} detectada: ${mostSevereConflict.allergenName}\n`;

    if (mostSevereConflict.reactionDescription) {
      message += `\nReação anterior: ${mostSevereConflict.reactionDescription}`;
    }

    if (result.conflicts.length > 1) {
      message += `\n\nTotal de conflitos detectados: ${result.conflicts.length}`;
    }

    return message;
  }
}