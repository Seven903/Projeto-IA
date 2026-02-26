// src/middlewares/auth.middleware.ts
// ============================================================
// Middleware de autenticação JWT.
//
// Responsabilidades:
//   • Extrair o token do header Authorization (Bearer <token>)
//   • Verificar assinatura e expiração via jwt.verify()
//   • Injetar req.user com o payload decodificado
//   • Injetar res.locals.requestId para rastreabilidade
//   • Bloquear requisições sem token ou com token inválido
//
// Uso nas rotas:
//   router.use(requireAuth)              → protege toda a rota
//   router.get('/me', requireAuth, ...)  → protege endpoint específico
//
// Fluxo de extração do token:
//   Authorization: Bearer eyJhbGci...
//   → extrai a segunda parte após "Bearer "
//   → verifica com JWT_SECRET
//   → injeta em req.user
// ============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../types/express.d';
import { sendUnauthorized } from '../utils/responseBuilder';

const JWT_SECRET = process.env.JWT_SECRET ?? 'TROQUE_EM_PRODUCAO';

/**
 * Middleware que valida o JWT e injeta req.user.
 * Bloqueia a requisição com 401 se o token estiver ausente,
 * expirado ou com assinatura inválida.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ── Injeta requestId em todas as requisições ─────────────
  // Gerado aqui para estar disponível mesmo em requisições rejeitadas
  const requestId = uuidv4();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // ── Extrai o token do header ─────────────────────────────
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendUnauthorized(
      res,
      'Token de autenticação ausente. Inclua o header: Authorization: Bearer <token>'
    );
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    sendUnauthorized(res, 'Token de autenticação malformado.');
    return;
  }

  // ── Verifica e decodifica o token ────────────────────────
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Injeta o usuário decodificado no request
    req.user = {
      id: decoded.id,
      fullName: decoded.fullName,
      email: decoded.email,
      role: decoded.role,
      councilNumber: decoded.councilNumber,
      permissions: decoded.permissions,
    };

    next();

  } catch (error: any) {
    // Distingue token expirado de assinatura inválida
    if (error.name === 'TokenExpiredError') {
      sendUnauthorized(
        res,
        'Sessão expirada. Faça login novamente para continuar.'
      );
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      sendUnauthorized(res, 'Token de autenticação inválido.');
      return;
    }

    // Erro inesperado na verificação
    sendUnauthorized(res, 'Falha na autenticação. Tente novamente.');
  }
}

/**
 * Middleware opcional — injeta requestId sem exigir autenticação.
 * Usado em rotas públicas como /health e /auth/login para manter
 * rastreabilidade de todas as requisições.
 */
export function injectRequestId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.requestId ?? uuidv4();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}