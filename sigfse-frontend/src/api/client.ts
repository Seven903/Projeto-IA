// src/api/client.ts
// Instância axios compartilhada por toda a camada src/api/.
// Configura baseURL, timeout e dois interceptors:
//   request  → injeta o token JWT em toda requisição autenticada
//   response → trata 401 globalmente (token expirado = logout automático)

import axios from 'axios';

// Em desenvolvimento o Vite faz proxy de /api → http://localhost:3000
// O proxy é configurado em vite.config.ts: proxy: { '/api': 'http://localhost:3000' }
// Isso evita CORS porque o browser vê tudo como mesma origem (:5173)
// VITE_API_URL só é necessário em produção (ex: https://api.sigfse.com.br/api/v1)
const BASE_URL: string = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Injeta Bearer token em toda requisição
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sigfse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 = token expirado ou inválido → limpa sessão e redireciona para /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sigfse_token');
      localStorage.removeItem('sigfse_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);