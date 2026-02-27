// src/types/dispensation.types.ts
// ============================================================
// Tipos do domínio de dispensação e cross-check de alergia.
//
// Este arquivo contém as interfaces mais críticas do sistema:
// os tipos que modelam o resultado do AllergyCheckService e
// todo o fluxo de dispensação de medicamentos.
//
// Hierarquia de tipos:
//
//   AllergyConflict          → representa um conflito específico detectado
//   AllergyCheckResult       → resultado completo do cross-check
//   DispensationRequestDto   → entrada da API (o que o enfermeiro enviou)
//   DispensationResult       → saída da operação de dispensação
//   StockAlertDto            → alerta de estoque ou vencimento
// ============================================================

import { AllergySeverity } from '../models/Studentallergy';
import { AttendanceStatus } from '../models/Attendance';

// ============================================================
// CROSS-CHECK DE ALERGIA
// ============================================================

/**
 * Representa um único conflito de alergia detectado no cross-check.
 * Um aluno pode ter múltiplos conflitos se o medicamento tiver
 * compostos com mais de um princípio ativo alérgico.
 */
export interface AllergyConflict {
  /** ID da alergia na tabela student_allergies */
  allergyId: string;

  /** Nome amigável do alérgeno para exibição — Ex: "Dipirona (Novalgina)" */
  allergenName: string;

  /** Princípio ativo normalizado — chave do conflito */
  activeIngredient: string;

  /**
   * Severidade da alergia:
   *   anaphylactic → BLOQUEIO ABSOLUTO (sem override possível)
   *   severe       → BLOQUEIO (requer justificativa documentada)
   *   moderate     → ALERTA com confirmação obrigatória
   *   mild         → AVISO informativo
   */
  severity: AllergySeverity;

  /** Descrição da reação anterior do paciente */
  reactionDescription: string | null;

  /** Médico que diagnosticou a alergia */
  diagnosedBy: string | null;
}

/**
 * Resultado completo do cross-check de alergia realizado pelo AllergyCheckService.
 * É o tipo central do caminho crítico de segurança do sistema.
 */
export interface AllergyCheckResult {
  /** true se nenhum conflito bloqueante foi encontrado */
  safe: boolean;

  /**
   * Lista de todos os conflitos encontrados (pode ser vazia).
   * Em operação normal, se hasBlockingConflict=true, a dispensação é abortada.
   */
  conflicts: AllergyConflict[];

  /**
   * true se há pelo menos um conflito de severidade 'anaphylactic' ou 'severe'.
   * Quando true, a dispensação deve ser BLOQUEADA pelo DispensationService.
   */
  hasBlockingConflict: boolean;

  /**
   * true se há conflitos apenas de severidade 'mild' ou 'moderate'.
   * Quando true, exibe alerta mas permite confirmação pelo profissional.
   */
  hasWarningOnly: boolean;

  /**
   * O conflito mais grave encontrado (null se nenhum).
   * Usado para compor a mensagem de bloqueio exibida ao enfermeiro.
   */
  mostSevereConflict: AllergyConflict | null;

  /** Nome do estudante — incluído para facilitar a mensagem de erro */
  studentName: string;

  /** Nome do medicamento verificado */
  medicationName: string;

  /** Princípio ativo que foi verificado (normalizado) */
  activeIngredientChecked: string;
}

// ============================================================
// DISPENSAÇÃO
// ============================================================

/**
 * DTO de entrada para a rota POST /dispensations.
 * Representa o que o enfermeiro preenche no formulário de dispensação.
 */
export interface DispensationRequestDto {
  /** ID do atendimento ao qual a dispensação pertence */
  attendanceId: string;

  /** ID do lote específico a ser dispensado */
  batchId: string;

  /** Quantidade de unidades a dispensar (mínimo: 1) */
  quantityDispensed: number;

  /**
   * Instruções de posologia registradas pelo profissional.
   * Ex: "1 comprimido a cada 8 horas por 3 dias, após refeição."
   */
  dosageInstructions: string;

  /** Observações adicionais sobre a dispensação (opcional) */
  notes?: string;
}

/**
 * Resultado completo da operação de dispensação.
 * Retornado pelo DispensationService após sucesso ou falha.
 */
export interface DispensationResult {
  /** true se a dispensação foi concluída com sucesso */
  success: boolean;

  /**
   * Motivo da falha quando success=false.
   * Ausente quando success=true.
   */
  failureReason?:
    | 'ALLERGY_BLOCKED'       // Bloqueado por conflito anafílático ou severo
    | 'STOCK_INSUFFICIENT'    // Estoque insuficiente no lote
    | 'BATCH_EXPIRED'         // Lote vencido
    | 'ATTENDANCE_CLOSED'     // Atendimento já encerrado
    | 'UNAUTHORIZED'          // Usuário sem permissão de dispensação
    | 'INTERNAL_ERROR';       // Erro inesperado

  /** Resultado do cross-check de alergia (sempre presente) */
  allergyCheck: AllergyCheckResult;

  /** Dados da dispensação criada (presente apenas quando success=true) */
  dispensation?: {
    id: string;
    attendanceId: string;
    batchId: string;
    medicationName: string;
    activeIngredient: string;
    quantityDispensed: number;
    dosageInstructions: string;
    dispensedBy: string;
    dispensedAt: Date;
  };

  /** Estoque remanescente no lote após a dispensação (quando success=true) */
  remainingStock?: number;

  /** Alerta se estoque ficou abaixo do mínimo após a dispensação */
  stockAlert?: StockAlertDto;
}

// ============================================================
// ATENDIMENTO
// ============================================================

/**
 * DTO de entrada para abertura de atendimento (POST /attendances).
 */
export interface OpenAttendanceDto {
  /** Matrícula ou UUID do estudante */
  studentId: string;
  symptoms: string;
  clinicalNotes?: string;
  temperatureC?: number;
  bloodPressure?: string;
}

/**
 * DTO de entrada para encerramento de atendimento.
 */
export interface CloseAttendanceDto {
  status: Extract<AttendanceStatus, 'referred' | 'closed'>;
  clinicalNotes?: string;
  referralDestination?: string;
}

/**
 * DTO de saída de um atendimento completo com dispensações.
 */
export interface AttendanceDetailDto {
  id: string;
  student: {
    id: string;
    fullName: string;
    enrollmentCode: string;
    gradeClass: string | null;
    age: number;
    guardianName: string;
    guardianPhone: string;
    hasAllergies: boolean;
    allergyCount: number;
  };
  attendedBy: {
    id: string;
    fullName: string;
    role: string;
  };
  attendedAt: Date;
  symptoms: string;
  clinicalNotes: string | null;
  temperatureC: number | null;
  bloodPressure: string | null;
  status: AttendanceStatus;
  statusLabel: string;
  referralDestination: string | null;
  closedAt: Date | null;
  dispensations: DispensationDetailDto[];
}

/**
 * DTO de saída de uma dispensação com detalhes do medicamento e lote.
 */
export interface DispensationDetailDto {
  id: string;
  medication: {
    id: string;
    commercialName: string;
    activeIngredient: string;
    dosage: string;
    pharmaceuticalForm: string;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: Date;
  };
  dispensedBy: {
    id: string;
    fullName: string;
  };
  dispensedAt: Date;
  quantityDispensed: number;
  dosageInstructions: string;
  allergyCheckPassed: boolean;
  notes: string | null;
}

// ============================================================
// ESTOQUE E ALERTAS
// ============================================================

/**
 * DTO de alerta de estoque — agrupa estoque baixo e vencimento próximo.
 * Usado no dashboard do enfermeiro e nos relatórios de BI.
 */
export interface StockAlertDto {
  medicationId: string;
  sku: string;
  commercialName: string;
  activeIngredient: string;

  /** Quantidade total disponível somando todos os lotes */
  totalStock: number;
  minimumStockQty: number;

  /** true se totalStock <= minimumStockQty */
  isLowStock: boolean;

  /** Data de validade do lote mais próximo do vencimento */
  nearestExpiryDate: Date | null;

  /** true se nearestExpiryDate está dentro da janela de alerta */
  isExpiringSoon: boolean;

  /** true se o lote mais próximo já venceu */
  hasExpiredBatch: boolean;

  /** Label legível para exibição — Ex: "Vence em 12 dias ⚠️" */
  expiryStatusLabel: string;

  /** Nível de urgência do alerta — para ordenação e cor no dashboard */
  alertLevel: 'critical' | 'warning' | 'info';
}

/**
 * DTO de resumo do dashboard — dados da tela inicial do enfermeiro.
 */
export interface DashboardSummaryDto {
  attendancesToday: number;
  attendancesThisMonth: number;
  openAttendances: number;
  stockAlerts: StockAlertDto[];
  totalStockAlerts: number;
  lastUpdatedAt: Date;
}

// ============================================================
// BUSINESS INTELLIGENCE
// ============================================================

/**
 * Ponto do heatmap de frequência de atendimentos.
 */
export interface HeatmapPointDto {
  /** Dia da semana (0=Dom, 1=Seg, ..., 6=Sáb) */
  weekday: number;
  weekdayLabel: string;
  /** Hora do dia (0–23) */
  hour: number;
  hourLabel: string;
  /** Número de atendimentos neste slot */
  count: number;
}

/**
 * Item da Curva ABC de consumo de medicamentos.
 */
export interface AbcCurveItemDto {
  rank: number;
  medicationId: string;
  commercialName: string;
  activeIngredient: string;
  pharmaceuticalForm: string;
  totalDispensed: number;
  totalEvents: number;
  percentOfTotal: number;
  cumulativePercent: number;
  /** Classe Pareto: A (≤80%), B (≤95%), C (>95%) */
  abcClass: 'A' | 'B' | 'C';
}

/**
 * Resumo de cobertura de alergias mapeadas na comunidade escolar.
 */
export interface AllergyCoverageDto {
  totalActiveStudents: number;
  studentsWithAllergies: number;
  percentWithAllergies: number;
  breakdownBySeverity: {
    anaphylactic: number;
    severe: number;
    moderate: number;
    mild: number;
  };
}