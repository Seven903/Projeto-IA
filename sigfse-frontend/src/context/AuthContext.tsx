// src/context/AuthContext.tsx
// Context global de autenticação do SIGFSE.
//
// O backend retorna dois shapes diferentes para o usuário:
//
//   POST /auth/login e GET /auth/me  →  SystemUser.toSafeObject()
//   Permissões FLAT: { canDispense, canAccessHealthData, canManageStock }
//
//   JWT (req.user no backend)  →  AuthenticatedUser
//   Permissões ANINHADAS: { permissions: { canDispense, ... } }
//
// Para que todas as páginas usem sempre user.permissions.X,
// este context normaliza o toSafeObject() para o shape com
// permissions aninhado antes de salvar no estado.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { AuthUser, CurrentUser } from '../types';

// ── Normaliza AuthUser (toSafeObject) → CurrentUser ───────────
// toSafeObject retorna canAccessHealthData, canDispense e canManageStock
// como campos flat. Aninha em permissions para uso consistente nas páginas.
function normalize(raw: AuthUser): CurrentUser {
  return {
    id:            raw.id,
    fullName:      raw.fullName,
    email:         raw.email,
    role:          raw.role,
    councilNumber: raw.councilNumber,
    isActive:      raw.isActive,
    lastLoginAt:   raw.lastLoginAt,
    permissions: {
      canAccessHealthData: raw.canAccessHealthData,
      canDispense:         raw.canDispense,
      canManageStock:      raw.canManageStock,
      canAccessReports:    true, // todos os roles têm acesso (backend)
    },
  };
}

// ── Tipo do contexto ──────────────────────────────────────────
interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'sigfse_token';
const USER_KEY  = 'sigfse_user';

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaura sessão ao montar o app e valida o token via GET /auth/me
  useEffect(() => {
    async function restore() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      // O interceptor do client.ts já injeta o token no header.
      // Se /me retornar 401 (expirado), o interceptor limpa o storage
      // e redireciona para /login automaticamente.
      try {
        const fresh = await authApi.me();
        setUser(normalize(fresh));
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  // POST /auth/login → persiste token e user normalizados
  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(normalize(response.user));
  }, []);

  // POST /auth/logout → limpa estado e storage
  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignora erro de rede */ }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Recarrega dados frescos do usuário sem fazer logout.
  // Útil se um admin alterar o role de um usuário durante a sessão.
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      setUser(normalize(fresh));
      localStorage.setItem(USER_KEY, JSON.stringify(fresh));
    } catch {
      await logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook de consumo ───────────────────────────────────────────
// Uso nas páginas: const { user, login, logout } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}