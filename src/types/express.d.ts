// src/types/express.d.ts
// ============================================================
// Extensão de tipos do Express.
//
// Por que este arquivo existe?
//   O Express por padrão não sabe que req.user ou res.locals.requestId
//   existem. Sem esta declaração, o TypeScript acusaria erro em todo
//   middleware e controller que acessar essas propriedades.
//
//   Este arquivo usa "declaration merging" do TypeScript para
//   adicionar campos ao namespace global do Express sem modificar
//   a biblioteca original.
//
// Campos adicionados a Request:
//   req.user       → usuário autenticado injetado pelo auth.middleware
//   req.requestId  → ID único da requisição para rastreabilidade
//
// Campos adicionados a Response.locals:
//   res.locals.requestId → mesmo ID, disponível nos response builders
// ============================================================

import { UserRole } from '../models/SystemUser';

declare global {
  namespace Express {
    // ── Extensão do objeto Request ───────────────────────────
    interface Request {
      /**
       * Usuário autenticado, injetado pelo auth.middleware após
       * validação do JWT. Disponível em todas as rotas protegidas.
       *
       * É undefined em rotas públicas (ex: POST /auth/login).
       * Use o middleware requireAuth() para garantir que existe.
       */
      user?: AuthenticatedUser;

      /**
       * ID único da requisição — gerado pelo requestId.middleware
       * e presente em todos os logs e respostas da API.
       * Formato: UUID v4
       */
      requestId?: string;
    }

    // ── Extensão do objeto Response.locals ──────────────────
    interface Locals {
      /**
       * ID único da requisição — espelhado do req.requestId
       * para uso nos response builders via res.locals.requestId.
       */
      requestId?: string;
    }
  }
}

// ── Tipo do usuário autenticado ──────────────────────────────

/**
 * Representa o payload decodificado do JWT.
 * Contém apenas os campos necessários para autorização —
 * dados completos do usuário são buscados no banco quando necessário.
 */
export interface AuthenticatedUser {
  /** UUID do usuário — FK para system_users.id */
  id: string;

  /** Nome completo para logs e auditoria */
  fullName: string;

  /** E-mail do usuário */
  email: string;

  /** Role para verificações RBAC nos middlewares */
  role: UserRole;

  /** Número do conselho profissional (COREN, CRF, CRM) */
  councilNumber: string | null;

  /** Permissões computadas — derivadas da role */
  permissions: {
    canAccessHealthData: boolean;
    canDispense: boolean;
    canManageStock: boolean;
    canAccessReports: boolean;
  };
}

/**
 * Payload completo gravado no JWT (campos do JWT + AuthenticatedUser).
 */
export interface JwtPayload extends AuthenticatedUser {
  /** Issued At — timestamp de emissão (Unix) */
  iat: number;
  /** Expiration — timestamp de expiração (Unix) */
  exp: number;
}