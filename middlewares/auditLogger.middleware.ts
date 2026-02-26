// src/middlewares/auditLogger.middleware.ts
// ============================================================
// Middlewares de auditoria automática.
//
// auditDispensation:
//   Registra DISPENSE_ATTEMPT antes do controller executar.
//   Garante rastreabilidade mesmo se a requisição falhar com 500.
//   O DispensationService registra o resultado final
//   (DISPENSE_SUCCESS ou DISPENSE_BLOCKED_ALLERGY) separadamente.
//
// auditAccess:
//   Registra RECORD_VIEW ao acessar endpoints de dados sensíveis
//   como GET /students/:id/health.
//   Complementa o AuditLog gerado dentro do StudentService.
//
// Por que registrar no middleware E no service?
//   O middleware captura a TENTATIVA (mesmo antes do service rodar).
//   O service captura o RESULTADO com contexto completo.
//   Juntos, cobrem cenários de falha em qualquer camada.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';

/**
 * Registra DISPENSE_ATTEMPT no AuditLog antes do controller executar.
 * Aplicado exclusivamente na rota POST /dispensations.
 */
export async function auditDispensation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Só audita se o usuário estiver autenticado
  if (!req.user) {
    next();
    return;
  }

  try {
    await AuditLog.create({
      performedBy: req.user.id,
      action: 'DISPENSE_ATTEMPT',
      targetTable: 'dispensations',
      targetId: null,
      payload: {
        attendanceId: req.body?.attendanceId ?? null,
        batchId: req.body?.batchId ?? null,
        quantityRequested: req.body?.quantityDispensed ?? null,
        requestedAt: new Date().toISOString(),
        requestId: req.requestId,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  } catch (auditError) {
    // Falha no audit log NÃO deve bloquear a requisição principal
    // Apenas loga o erro internamente
    console.error('[auditLogger] Falha ao registrar DISPENSE_ATTEMPT:', auditError);
  }

  next();
}

/**
 * Registra RECORD_VIEW no AuditLog ao acessar dados sensíveis de saúde.
 * Aplicado na rota GET /students/:id/health.
 */
export async function auditAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    await AuditLog.create({
      performedBy: req.user.id,
      action: 'RECORD_VIEW',
      targetTable: 'students',
      targetId: req.params.id ?? null,
      payload: {
        endpoint: req.originalUrl,
        method: req.method,
        accessedAt: new Date().toISOString(),
        requestId: req.requestId,
      },
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  } catch (auditError) {
    console.error('[auditLogger] Falha ao registrar RECORD_VIEW:', auditError);
  }

  next();
}