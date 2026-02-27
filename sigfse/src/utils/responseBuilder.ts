// src/utils/responseBuilder.ts
// ============================================================
// Construtor de respostas de API padronizadas.
//
// Por que padronizar respostas?
//   O frontend espera sempre o mesmo envelope JSON, independente
//   de sucesso ou erro. Isso simplifica o tratamento no cliente
//   e facilita logs, monitoramento e testes automatizados.
//
// Envelope padrão de sucesso:
//   {
//     "success": true,
//     "data": <T>,
//     "meta": { "timestamp": "...", "requestId": "..." },
//     "pagination": { "page": 1, "limit": 20, "total": 100 }  // opcional
//   }
//
// Envelope padrão de erro:
//   {
//     "success": false,
//     "error": {
//       "code": "ALLERGY_CONFLICT",
//       "message": "Conflito de alergia detectado.",
//       "details": { ... }   // opcional — só em desenvolvimento
//     },
//     "meta": { "timestamp": "...", "requestId": "..." }
//   }
// ============================================================

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ── Tipos da interface de resposta ───────────────────────────

export interface ApiMeta {
  timestamp: string;
  requestId: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Códigos de erro do domínio SIGFSE ────────────────────────
export type ErrorCode =
  | 'VALIDATION_ERROR'         // Dados de entrada inválidos
  | 'NOT_FOUND'                // Recurso não encontrado
  | 'UNAUTHORIZED'             // Não autenticado
  | 'FORBIDDEN'                // Autenticado mas sem permissão
  | 'ALLERGY_CONFLICT'         // Cross-check de alergia bloqueou a dispensação
  | 'ALLERGY_WARNING'          // Alergia detectada (não bloqueante)
  | 'STOCK_INSUFFICIENT'       // Estoque insuficiente para dispensação
  | 'BATCH_EXPIRED'            // Lote vencido — não pode ser dispensado
  | 'LGPD_CONSENT_MISSING'     // Aluno sem consentimento LGPD registrado
  | 'DUPLICATE_RECORD'         // Registro duplicado (ex: matrícula já cadastrada)
  | 'INTERNAL_ERROR'           // Erro interno inesperado
  | 'DATABASE_ERROR';          // Erro de banco de dados

// ── Funções construtoras ─────────────────────────────────────

/**
 * Constrói e envia uma resposta de sucesso padronizada.
 *
 * @param res        - Objeto Response do Express
 * @param data       - Dados a retornar no campo `data`
 * @param statusCode - HTTP status code (padrão: 200)
 * @param pagination - Metadados de paginação (opcional)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  pagination?: PaginationMeta
): Response {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: buildMeta(res),
    ...(pagination && { pagination }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Constrói e envia uma resposta de criação bem-sucedida (201).
 * Atalho para sendSuccess com statusCode 201.
 *
 * @param res  - Objeto Response do Express
 * @param data - Recurso criado
 */
export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

/**
 * Constrói e envia uma resposta de erro padronizada.
 *
 * @param res        - Objeto Response do Express
 * @param statusCode - HTTP status code (ex: 400, 403, 404, 500)
 * @param code       - Código de erro do domínio SIGFSE
 * @param message    - Mensagem legível para o usuário final
 * @param details    - Detalhes técnicos (só incluídos em desenvolvimento)
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown
): Response {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      // Detalhes técnicos apenas em dev — evita vazamento de informações em prod
      ...(isDevelopment && details !== undefined && { details }),
    },
    meta: buildMeta(res),
  };

  return res.status(statusCode).json(response);
}

// ── Atalhos para erros comuns ────────────────────────────────

/**
 * 400 — Dados de entrada inválidos.
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: unknown
): Response {
  return sendError(res, 400, 'VALIDATION_ERROR', message, details);
}

/**
 * 401 — Não autenticado (token ausente ou inválido).
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Autenticação necessária. Faça login para continuar.'
): Response {
  return sendError(res, 401, 'UNAUTHORIZED', message);
}

/**
 * 403 — Autenticado mas sem permissão para o recurso.
 */
export function sendForbidden(
  res: Response,
  message: string = 'Acesso negado. Seu perfil não tem permissão para esta ação.'
): Response {
  return sendError(res, 403, 'FORBIDDEN', message);
}

/**
 * 404 — Recurso não encontrado.
 */
export function sendNotFound(
  res: Response,
  resource: string = 'Recurso'
): Response {
  return sendError(res, 404, 'NOT_FOUND', `${resource} não encontrado.`);
}

/**
 * 409 — Conflito de alergia (bloqueio de dispensação).
 * Este é o erro mais crítico do sistema — sinalizado com código próprio.
 *
 * @param res     - Objeto Response do Express
 * @param details - Detalhes do conflito (alérgeno, severidade, reação)
 */
export function sendAllergyConflict(
  res: Response,
  details: {
    studentName: string;
    allergenName: string;
    activeIngredient: string;
    severity: string;
    reactionDescription?: string | null;
  }
): Response {
  return sendError(
    res,
    409,
    'ALLERGY_CONFLICT',
    `⚠️ DISPENSAÇÃO BLOQUEADA: ${details.studentName} possui alergia ` +
    `${details.severity === 'anaphylactic' ? 'ANAFILÁTICA' : 'SEVERA'} ` +
    `ao princípio ativo "${details.activeIngredient}" (${details.allergenName}).`,
    details
  );
}

/**
 * 409 — Estoque insuficiente para a quantidade solicitada.
 */
export function sendStockInsufficient(
  res: Response,
  requested: number,
  available: number,
  medicationName: string
): Response {
  return sendError(
    res,
    409,
    'STOCK_INSUFFICIENT',
    `Estoque insuficiente para "${medicationName}". ` +
    `Solicitado: ${requested} unidade(s). Disponível: ${available} unidade(s).`,
    { requested, available, medicationName }
  );
}

/**
 * 500 — Erro interno inesperado.
 * Em produção, esconde os detalhes técnicos do cliente.
 */
export function sendInternalError(
  res: Response,
  error?: unknown
): Response {
  return sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'Ocorreu um erro interno no servidor. Tente novamente em instantes.',
    error
  );
}

// ── Construtor de paginação ──────────────────────────────────

/**
 * Constrói o objeto de metadados de paginação.
 *
 * @param total - Total de registros encontrados
 * @param page  - Página atual (começa em 1)
 * @param limit - Registros por página
 * @returns PaginationMeta completo
 */
export function buildPagination(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Extrai e valida os parâmetros de paginação de uma query string.
 * Retorna valores padrão seguros se os parâmetros forem inválidos.
 *
 * @param query - Objeto query da requisição Express (req.query)
 * @returns { page, limit, offset }
 */
export function parsePaginationQuery(query: Record<string, unknown>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ── Utilitário interno ───────────────────────────────────────

/**
 * Constrói o objeto meta da resposta.
 * Usa o requestId injetado pelo middleware se disponível.
 */
function buildMeta(res: Response): ApiMeta {
  return {
    timestamp: new Date().toISOString(),
    // O middleware de request-id injeta o ID em res.locals
    requestId: (res.locals.requestId as string) ?? uuidv4(),
  };
}