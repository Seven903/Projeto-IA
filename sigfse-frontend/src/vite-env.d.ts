/// <reference types="vite/client" />

// Declaração explícita das variáveis de ambiente do SIGFSE.
// Qualquer VITE_* adicionado ao .env deve ser declarado aqui
// para que o TypeScript reconheça o tipo correto.
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}