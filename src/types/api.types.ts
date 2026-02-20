// src/types/api.types.ts
// ============================================================
// Tipos globais da camada de API.
//
// Centraliza as interfaces usadas em toda a camada HTTP:
//   • Envelopes de resposta (ApiResponse, PaginatedResponse)
//   • Parâmetros de paginação e filtros comuns
//   • Tipos de erro padronizados
//   • DTOs de entrada e saída compartilhados entre módulos
//
// Convenção de nomenclatura:
//   XxxDto    → Data Transfer Object (corpo de req/res)
//   XxxQuery  → Parâmetros de query string (req.query)
//   XxxParams → Parâmetros de rota (req.params)
// ============================================================

// ── Re-exportações dos response builders ────────────────────
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiMeta,
  PaginationMeta,
  ErrorCode,
} from '../utils/responseBuilder';

// ── Parâmetros de rota comuns ────────────────────────────────

/** Parâmetros de rota com ID UUID */
export interface IdParams {
  id: string;
}

/** Parâmetros de rota para rotas aninhadas — Ex: /students/:studentId/allergies/:id */
export interface NestedIdParams {
  id: string;
  studentId: string;
}

// ── Paginação ────────────────────────────────────────────────

/** Query string de paginação comum a todas as listagens */
export interface PaginationQuery {
  /** Número da página (começa em 1). Padrão: 1 */
  page?: string;
  /** Itens por página (máx. 100). Padrão: 20 */
  limit?: string;
}

/** Query string com filtro de período por data */
export interface DateRangeQuery extends PaginationQuery {
  /** Data de início no formato YYYY-MM-DD */
  startDate?: string;
  /** Data de fim no formato YYYY-MM-DD */
  endDate?: string;
}

// ── Tipos de entrada (DTOs de request body) ─────────────────

/** DTO de login */
export interface LoginDto {
  email: string;
  password: string;
}

/** DTO de resposta do login */
export interface LoginResponseDto {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    councilNumber: string | null;
    permissions: {
      canAccessHealthData: boolean;
      canDispense: boolean;
      canManageStock: boolean;
      canAccessReports: boolean;
    };
  };
}

// ── Tipos de saída (DTOs de response) ───────────────────────

/**
 * DTO genérico de confirmação de operação.
 * Usado em respostas de DELETE e ações sem retorno de dados.
 */
export interface OperationResultDto {
  message: string;
  affectedId?: string;
}

/**
 * DTO de item de lista simplificada.
 * Usado em selects e autocompletes do frontend.
 */
export interface SelectOptionDto {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
}

// ── Tipos de query para busca ────────────────────────────────

/** Query de busca de estudantes */
export interface StudentSearchQuery extends PaginationQuery {
  /** Busca por nome ou matrícula */
  q?: string;
  /** Filtrar por turma */
  gradeClass?: string;
  /** Filtrar apenas ativos (padrão: true) */
  isActive?: string;
}

/** Query de busca de medicamentos */
export interface MedicationSearchQuery extends PaginationQuery {
  q?: string;
  isControlled?: string;
  isActive?: string;
}

/** Query de busca de atendimentos */
export interface AttendanceSearchQuery extends DateRangeQuery {
  studentId?: string;
  attendedBy?: string;
  status?: string;
}

/** Query de busca de logs de auditoria */
export interface AuditLogSearchQuery extends DateRangeQuery {
  performedBy?: string;
  action?: string;
  targetTable?: string;
}

// ── Tipos de ordenação ───────────────────────────────────────

export type SortOrder = 'ASC' | 'DESC';

export interface SortQuery {
  sortBy?: string;
  sortOrder?: SortOrder;
}