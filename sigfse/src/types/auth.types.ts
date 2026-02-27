// src/types/auth.types.ts
// ============================================================
// Tipos de autenticação exportados para uso nos services e middlewares.
//
// Por que este arquivo existe separado do express.d.ts?
//   O express.d.ts é um arquivo de declaration merging (augmentation)
//   do namespace global do Express. Alguns compiladores TS rejeitam
//   importar tipos de arquivos .d.ts explicitamente.
//   Este arquivo .ts normal exporta os mesmos tipos de forma segura.
// ============================================================

import { UserRole } from '../models/SystemUser';

/**
 * Representa o usuário autenticado injetado em req.user pelo auth.middleware.
 * Derivado do payload do JWT após verificação da assinatura.
 */
export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  councilNumber: string | null;
  permissions: {
    canAccessHealthData: boolean;
    canDispense: boolean;
    canManageStock: boolean;
    canAccessReports: boolean;
  };
}

/**
 * Payload completo gravado no JWT.
 */
export interface JwtPayload extends AuthenticatedUser {
  iat: number;
  exp: number;
}