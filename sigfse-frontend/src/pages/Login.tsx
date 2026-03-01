// src/pages/Login.tsx
// Página pública — rota /login
// Chama POST /api/v1/auth/login via authApi.login()
// Após sucesso redireciona para /dashboard

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cross, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha e-mail e senha.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error?.message ?? 'Credenciais inválidas.'
        : 'Erro ao conectar. Tente novamente.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-3">
            <Cross className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">SIGFSE</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestão de Saúde Escolar</p>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Entrar na conta</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                  placeholder:text-gray-400 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                  placeholder:text-gray-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full bg-brand-600 hover:bg-brand-700 text-white font-medium
                rounded-lg py-2.5 text-sm flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          SIGFSE © {new Date().getFullYear()} — Uso restrito a profissionais autorizados
        </p>
      </div>
    </div>
  );
}