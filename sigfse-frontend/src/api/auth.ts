// src/api/auth.ts
// Conecta com as rotas do backend em src/routes/auth.routes.ts:
//   POST /api/v1/auth/login   → AuthController.login
//   POST /api/v1/auth/logout  → AuthController.logout
//   GET  /api/v1/auth/me      → AuthController.me

import { api } from './client';
import type { ApiSuccessResponse, LoginResponse, AuthUser } from '../types';

export const authApi = {
  // Envia { email, password } — validado por loginSchema do backend
  // Retorna { token, expiresIn, user } onde user = SystemUser.toSafeObject()
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post<ApiSuccessResponse<LoginResponse>>(
      '/auth/login',
      { email, password }
    );
    return data.data;
  },

  // Requer Authorization: Bearer <token>
  // Grava AuditLog no backend — ignora erro de rede no logout
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  // Retorna dados frescos do usuário logado via SystemUser.toSafeObject()
  // Usado na restauração de sessão para validar se o token ainda é válido
  me: async (): Promise<AuthUser> => {
    const { data } = await api.get<ApiSuccessResponse<AuthUser>>('/auth/me');
    return data.data;
  },
};