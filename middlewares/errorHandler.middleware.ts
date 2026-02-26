// src/middlewares/errorHandler.middleware.ts
// ============================================================
// Middleware global de tratamento de erros.
//
// Responsabilidades:
//   • Capturar todos os erros não tratados pelos controllers
//   • Interpretar erros do Sequelize e convertê-los em respostas legíveis
//   • Interpretar erros de validação do Zod
//   • Garantir que NENHUM erro interno vaze detalhes técnicos em produção
//   • Padronizar todas as respostas de erro no envelope ApiErrorResponse
//
// Deve ser registrado APÓS todas as rotas no Express:
//   app.use(errorHandler);
//
// Validate middleware (Zod):
//   Também exportado aqui — valida req.body/params/query
//   contra um schema Zod antes do controller ser chamado.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import {
  sendValidationError,
  sendNotFound,
  sendInternalError,
  sendError,
} from '../utils/responseBuilder';

// ── VALIDATE MIDDLEWARE (Zod) ────────────────────────────────

/**
 * Gera um middleware que valida req.body, req.params e req.query
 * contra um schema Zod. Retorna 400 com mensagens de erro detalhadas
 * se a validação falhar.
 *
 * @param schema - Schema Zod que pode conter body, params e/ou query
 *
 * @example
 * router.post('/', validate(createStudentSchema), controller.create);
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      // Formata os erros do Zod em mensagens legíveis
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.').replace(/^(body|params|query)\./, ''),
        message: err.message,
      }));

      // Primeira mensagem de erro como mensagem principal
      const firstMessage = errors[0]?.message ?? 'Dados de entrada inválidos.';

      sendValidationError(res, firstMessage, { errors });
      return;
    }

    // Atualiza req com os dados validados e transformados pelo Zod
    // (ex: .trim(), .toLowerCase(), .default())
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.params !== undefined) req.params = result.data.params;
    if (result.data.query !== undefined) req.query = result.data.query;

    next();
  };
}

// ── ERROR HANDLER GLOBAL ─────────────────────────────────────

/**
 * Middleware de tratamento global de erros.
 * Deve ser o ÚLTIMO middleware registrado na aplicação Express.
 *
 * Trata:
 *   ZodError                          → 400 VALIDATION_ERROR
 *   SequelizeValidationError          → 400 VALIDATION_ERROR
 *   SequelizeUniqueConstraintError    → 409 DUPLICATE_RECORD
 *   SequelizeForeignKeyConstraintError → 400 VALIDATION_ERROR
 *   SequelizeDatabaseError            → 500 DATABASE_ERROR
 *   Error genérico                    → 500 INTERNAL_ERROR
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development';

  // Log sempre — independente do ambiente
  console.error(
    `[ErrorHandler] ${req.method} ${req.originalUrl} — ${err.name}: ${err.message}`,
    isDev ? err.stack : ''
  );

  // ── Erros de validação Zod ───────────────────────────────
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendValidationError(
      res,
      errors[0]?.message ?? 'Dados de entrada inválidos.',
      isDev ? { errors } : undefined
    );
    return;
  }

  // ── Erros do Sequelize ───────────────────────────────────
  const errName = err.name ?? '';

  if (errName === 'SequelizeValidationError') {
    const seqErr = err as any;
    const message = seqErr.errors?.[0]?.message ?? 'Dados inválidos.';
    sendValidationError(res, message, isDev ? err : undefined);
    return;
  }

  if (errName === 'SequelizeUniqueConstraintError') {
    const seqErr = err as any;
    const field = seqErr.errors?.[0]?.path ?? 'campo';
    sendError(
      res,
      409,
      'DUPLICATE_RECORD',
      `Já existe um registro com este valor para o campo "${field}".`,
      isDev ? err : undefined
    );
    return;
  }

  if (errName === 'SequelizeForeignKeyConstraintError') {
    sendValidationError(
      res,
      'Operação inválida: o registro referenciado não existe ou não pode ser modificado.',
      isDev ? err : undefined
    );
    return;
  }

  if (errName === 'SequelizeDatabaseError') {
    sendError(
      res,
      500,
      'DATABASE_ERROR',
      'Erro interno no banco de dados. Tente novamente em instantes.',
      isDev ? { message: err.message } : undefined
    );
    return;
  }

  if (errName === 'SequelizeConnectionError') {
    sendError(
      res,
      503,
      'DATABASE_ERROR',
      'Serviço temporariamente indisponível. Falha na conexão com o banco de dados.',
      isDev ? { message: err.message } : undefined
    );
    return;
  }

  // ── Erros de negócio conhecidos ──────────────────────────
  // Erros lançados intencionalmente pelos services com mensagens legíveis
  if (err.message?.includes('não encontrado') || err.message?.includes('não encontrada')) {
    sendNotFound(res, err.message.replace(' não encontrado.', '').replace(' não encontrada.', ''));
    return;
  }

  if (err.message?.includes('imutável') || err.message?.includes('IMUTÁVEL')) {
    sendError(
      res,
      403,
      'FORBIDDEN',
      err.message,
      isDev ? err : undefined
    );
    return;
  }

  // ── Erro interno genérico ────────────────────────────────
  sendInternalError(res, isDev ? { message: err.message, stack: err.stack } : undefined);
}

// ── NOT FOUND HANDLER ────────────────────────────────────────

/**
 * Middleware para rotas não encontradas (404).
 * Deve ser registrado após todas as rotas, antes do errorHandler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    404,
    'NOT_FOUND',
    `Endpoint não encontrado: ${req.method} ${req.originalUrl}`
  );
}