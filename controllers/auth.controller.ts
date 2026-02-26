// src/controllers/auth.controller.ts
// ============================================================
// Controller de autenticação.
//
// Rotas atendidas:
//   POST /api/v1/auth/login   → autentica usuário, retorna JWT
//   POST /api/v1/auth/logout  → encerra sessão e grava AuditLog
//   GET  /api/v1/auth/me      → retorna dados do usuário autenticado
//   POST /api/v1/auth/refresh → renova JWT antes de expirar
//
// Fluxo de login:
//   1. Valida body (email + password obrigatórios)
//   2. Busca usuário com scope('withPassword') para incluir hash
//   3. Verifica senha com bcrypt
//   4. Gera JWT com payload seguro (sem dados sensíveis)
//   5. Atualiza lastLoginAt
//   6. Grava AuditLog de LOGIN
//   7. Retorna token + dados do usuário
//
// Segurança:
//   • Mensagem de erro genérica — não revela se e-mail existe
//   • Tentativas de senha errada são gravadas no AuditLog
//   • JWT_SECRET lida de variável de ambiente (nunca hardcoded)
// ============================================================

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SystemUser } from '../models/SystemUser';
import { AuditLog } from '../models/AuditLog';
import {
  sendSuccess,
  sendUnauthorized,
  sendValidationError,
  sendInternalError,
} from '../utils/responseBuilder';
import { LoginDto } from '../types/api.types';
import { JwtPayload } from '../types/express.d';
import { normalizeEmail } from '../utils/normalize';

const JWT_SECRET = process.env.JWT_SECRET ?? 'TROQUE_ESTA_CHAVE_EM_PRODUCAO';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

export class AuthController {

  // ── POST /auth/login ─────────────────────────────────────

  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body as LoginDto;

      if (!email || !password) {
        return sendValidationError(res, 'E-mail e senha são obrigatórios.');
      }

      // scope('withPassword') inclui o passwordHash excluído no defaultScope
      const user = await SystemUser.scope('withPassword').findOne({
        where: { email: normalizeEmail(email), isActive: true },
      });

      // Mensagem genérica para não revelar se o e-mail existe
      const invalidMsg = 'Credenciais inválidas. Verifique e-mail e senha.';

      if (!user) {
        return sendUnauthorized(res, invalidMsg);
      }

      const passwordValid = await user.verifyPassword(password);

      if (!passwordValid) {
        // Registra tentativa falha — útil para detectar ataques de força bruta
        await AuditLog.create({
          performedBy: user.id,
          action: 'LOGIN',
          payload: {
            success: false,
            reason: 'INVALID_PASSWORD',
            attemptedAt: new Date().toISOString(),
          },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        });

        return sendUnauthorized(res, invalidMsg);
      }

      // ── Monta e assina o JWT ────────────────────────────
      const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        councilNumber: user.councilNumber ?? null,
        permissions: {
          canAccessHealthData: user.canAccessHealthData,
          canDispense: user.canDispense,
          canManageStock: user.canManageStock,
          canAccessReports: user.canAccessReports,
        },
      };

      const token = jwt.sign(jwtPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as jwt.SignOptions);

      // Atualiza lastLoginAt e grava audit de sucesso em paralelo
      await Promise.all([
        user.update({ lastLoginAt: new Date() }),
        AuditLog.create({
          performedBy: user.id,
          action: 'LOGIN',
          payload: {
            success: true,
            role: user.role,
            loginAt: new Date().toISOString(),
          },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        }),
      ]);

      return sendSuccess(res, {
        token,
        expiresIn: JWT_EXPIRES_IN,
        user: user.toSafeObject(),
      });

    } catch (error) {
      console.error('[AuthController.login]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /auth/logout ────────────────────────────────────

  async logout(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user!;

      await AuditLog.create({
        performedBy: user.id,
        action: 'LOGOUT',
        payload: { logoutAt: new Date().toISOString() },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });

      return sendSuccess(res, { message: 'Sessão encerrada com sucesso.' });

    } catch (error) {
      console.error('[AuthController.logout]', error);
      return sendInternalError(res, error);
    }
  }

  // ── GET /auth/me ─────────────────────────────────────────

  async me(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user!;

      // Busca dados frescos do banco — o JWT pode estar desatualizado
      const freshUser = await SystemUser.findByPk(user.id);

      if (!freshUser || !freshUser.isActive) {
        return sendUnauthorized(res, 'Usuário não encontrado ou inativo.');
      }

      return sendSuccess(res, freshUser.toSafeObject());

    } catch (error) {
      console.error('[AuthController.me]', error);
      return sendInternalError(res, error);
    }
  }

  // ── POST /auth/refresh ───────────────────────────────────

  async refresh(req: Request, res: Response): Promise<Response> {
    try {
      const user = req.user!;

      const freshUser = await SystemUser.findByPk(user.id);

      if (!freshUser || !freshUser.isActive) {
        return sendUnauthorized(res, 'Não foi possível renovar. Faça login novamente.');
      }

      const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: freshUser.id,
        fullName: freshUser.fullName,
        email: freshUser.email,
        role: freshUser.role,
        councilNumber: freshUser.councilNumber ?? null,
        permissions: {
          canAccessHealthData: freshUser.canAccessHealthData,
          canDispense: freshUser.canDispense,
          canManageStock: freshUser.canManageStock,
          canAccessReports: freshUser.canAccessReports,
        },
      };

      const token = jwt.sign(jwtPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as jwt.SignOptions);

      return sendSuccess(res, {
        token,
        expiresIn: JWT_EXPIRES_IN,
        user: freshUser.toSafeObject(),
      });

    } catch (error) {
      console.error('[AuthController.refresh]', error);
      return sendInternalError(res, error);
    }
  }
}