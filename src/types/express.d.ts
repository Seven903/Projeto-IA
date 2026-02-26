// src/types/express.d.ts
// ============================================================
// Extensão do namespace global do Express via declaration merging.
// Os tipos AuthenticatedUser e JwtPayload estão em auth.types.ts.
// ============================================================

import { AuthenticatedUser } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
    interface Locals {
      requestId?: string;
    }
  }
}

// Re-exporta para compatibilidade com imports existentes
export type { AuthenticatedUser, JwtPayload } from './auth.types';