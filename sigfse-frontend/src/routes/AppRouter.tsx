// src/routes/AppRouter.tsx
// Roteador principal do SIGFSE.
// Define todas as rotas públicas e privadas da aplicação.
//
// Regras de acesso espelhando o RBAC do backend (rbac.middleware.ts):
//   /login          → pública, redireciona para /dashboard se já autenticado
//   /dashboard      → todos os roles autenticados
//   /atendimentos   → todos os roles autenticados (permissões granulares dentro da página)
//   /estudantes     → todos os roles autenticados
//   /estoque        → todos os roles autenticados
//   /auditoria      → apenas superadmin

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui/Spinner';
import { AppLayout } from '../components/layout/AppLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Atendimentos } from '../pages/Atendimentos';
import { Estudantes } from '../pages/Estudantes';
import { Estoque } from '../pages/Estoque';

// ── Rota pública ──────────────────────────────────────────────
// Se já autenticado, redireciona para /dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── Rota privada ──────────────────────────────────────────────
// Se não autenticado, redireciona para /login
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Rota restrita por role ────────────────────────────────────
// Redireciona para /dashboard se o role não tiver acesso
function RoleRoute({
  children,
  allowed,
}: {
  children: React.ReactNode;
  allowed: string[];
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── AppRouter ─────────────────────────────────────────────────
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Rota pública */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Rotas privadas — todas dentro do AppLayout (Sidebar + Outlet) */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/atendimentos" element={<Atendimentos />} />
          <Route path="/estudantes"   element={<Estudantes />} />
          <Route path="/estoque"      element={<Estoque />} />

          {/* Auditoria — apenas superadmin (espelha GET /reports/audit do backend) */}
          <Route
            path="/auditoria"
            element={
              <RoleRoute allowed={['superadmin']}>
                {/* Placeholder até a página de Auditoria ser criada */}
                <div className="text-sm text-gray-500 py-10 text-center">
                  Página de Auditoria — em desenvolvimento
                </div>
              </RoleRoute>
            }
          />
        </Route>

        {/* Qualquer rota não mapeada → /dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
}