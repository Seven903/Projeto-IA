// src/components/layout/Sidebar.tsx
// Menu lateral fixo da aplicação.
// Usa CurrentUser do AuthContext para exibir nome, role e controlar
// visibilidade do item de Auditoria (somente superadmin).
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  Pill,
  ShieldAlert,
  LogOut,
  Cross,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Itens de menu visíveis para todos os roles autenticados
const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/atendimentos', icon: Stethoscope,      label: 'Atendimentos' },
  { to: '/estudantes',   icon: Users,            label: 'Estudantes' },
  { to: '/estoque',      icon: Pill,             label: 'Estoque' },
];

// Labels legíveis por role — espelha UserRole do backend
const roleLabels: Record<string, string> = {
  nurse:      'Enfermeiro(a)',
  pharmacist: 'Farmacêutico(a)',
  admin:      'Administrador(a)',
  superadmin: 'Super Admin',
};

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-screen fixed left-0 top-0 z-30">

      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Cross className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">SIGFSE</p>
            <p className="text-[10px] text-gray-400 leading-tight">Saúde Escolar</p>
          </div>
        </div>
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${isActive
                ? 'bg-brand-600 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }
            `}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Auditoria — visível apenas para superadmin */}
        {user?.role === 'superadmin' && (
          <NavLink
            to="/auditoria"
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${isActive
                ? 'bg-gray-700 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }
            `}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            Auditoria
          </NavLink>
        )}
      </nav>

      {/* Usuário logado + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400">
              {roleLabels[user?.role ?? ''] ?? user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}