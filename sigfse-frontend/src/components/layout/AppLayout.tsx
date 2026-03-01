// src/components/layout/AppLayout.tsx
// Layout raiz de todas as páginas autenticadas.
// Renderiza Sidebar + conteúdo da página via <Outlet> do React Router.
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Conteúdo principal — ml-60 para não sobrepor a sidebar fixa */}
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>

      {/* Toast de feedback global — usado por todas as páginas */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: '0.875rem', borderRadius: '0.5rem' },
        }}
      />
    </div>
  );
}