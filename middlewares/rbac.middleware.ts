// src/middlewares/rbac.middleware.ts
// ============================================================
// Middleware de controle de acesso por role (RBAC).
//
// Responsabilidade:
//   Verificar se o usuário autenticado (req.user) possui uma das
//   roles autorizadas para acessar o endpoint. Deve ser usado
//   APÓS o requireAuth, que garante que req.user existe.
//
// Uso:
//   // Apenas enfermeiros e superadmin
//   router.post('/', requireRole('nurse', 'superadmin'), controller.create);
//
//   // Apenas farmacêuticos e superadmin
//   router.post('/batches', requireRole('pharmacist', 'superadmin'), controller.receive);
//
//   // Apenas superadmin
//   router.get('/audit', requireRole('superadmin'), controller.audit);
//
// Hierarquia de roles:
//   superadmin   → acesso irrestrito a tudo
//   nurse        → acesso a atendimentos, prontuários e dispensação
//   pharmacist   → acesso a estoque, lotes e dispensação
//   admin        → acesso apenas a relatórios anonimizados (BI)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/SystemUser';
import { sendForbidden, sendUnauthorized } from '../utils/responseBuilder';

/**
 * Gera um middleware que verifica se o usuário possui uma das roles permitidas.
 *
 * @param allowedRoles - Uma ou mais roles que têm acesso ao endpoint
 * @returns Middleware Express
 *
 * @example
 * router.post('/', requireRole('nurse', 'pharmacist', 'superadmin'), handler);
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    // requireAuth deve ter sido chamado antes — garante req.user
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(
        res,
        `Acesso negado. Esta ação requer um dos seguintes perfis: ` +
        `${allowedRoles.map(formatRoleLabel).join(', ')}. ` +
        `Seu perfil atual é: ${formatRoleLabel(req.user.role)}.`
      );
      return;
    }

    next();
  };
}

/**
 * Middleware que verifica se o usuário pode acessar dados de saúde.
 * Atalho para requireRole('nurse', 'pharmacist', 'superadmin').
 */
export function requireHealthAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendUnauthorized(res);
    return;
  }

  if (!req.user.permissions.canAccessHealthData) {
    sendForbidden(
      res,
      'Acesso negado. Seu perfil não tem permissão para visualizar dados de saúde. ' +
      'Administradores têm acesso apenas a estatísticas anonimizadas.'
    );
    return;
  }

  next();
}

/**
 * Middleware que verifica se o usuário pode realizar dispensações.
 * Atalho para requireRole('nurse', 'pharmacist', 'superadmin').
 */
export function requireDispenseAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendUnauthorized(res);
    return;
  }

  if (!req.user.permissions.canDispense) {
    sendForbidden(
      res,
      'Acesso negado. Apenas enfermeiros e farmacêuticos podem realizar dispensações.'
    );
    return;
  }

  next();
}

/**
 * Middleware que verifica se o usuário pode gerenciar estoque.
 * Atalho para requireRole('pharmacist', 'superadmin').
 */
export function requireStockAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendUnauthorized(res);
    return;
  }

  if (!req.user.permissions.canManageStock) {
    sendForbidden(
      res,
      'Acesso negado. Apenas farmacêuticos podem gerenciar o estoque.'
    );
    return;
  }

  next();
}

// ── Helper interno ───────────────────────────────────────────

/**
 * Retorna o label legível de uma role para mensagens de erro.
 */
function formatRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    nurse: 'Enfermeiro(a)',
    pharmacist: 'Farmacêutico(a)',
    admin: 'Administrador(a)',
    superadmin: 'Super Administrador',
  };
  return labels[role] ?? role;
}