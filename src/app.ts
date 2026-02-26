// src/app.ts
// ============================================================
// Configuração central do Express.
//
// Ordem de registro dos middlewares (importa):
//   1. injectRequestId      → rastreabilidade em todas as req
//   2. helmet               → headers de segurança HTTP
//   3. cors                 → libera origens autorizadas
//   4. express.json()       → parse do body JSON
//   5. express.urlencoded() → parse de form data
//   6. morgan               → log de requisições HTTP
//   7. rotas (/api/v1/*)    → controllers da aplicação
//   8. notFoundHandler      → 404 para rotas não mapeadas
//   9. errorHandler         → captura global de erros (deve ser ÚLTIMO)
// ============================================================

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { injectRequestId } from './middlewares/auth.middleware';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';
import routes from './routes/index';

export function createApp(): Application {
  const app = express();

  // ── 1. Request ID em todas as requisições ──────────────
  app.use(injectRequestId);

  // ── 2. Headers de segurança HTTP (OWASP) ──────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      // HSTS — força HTTPS por 1 ano
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    })
  );

  // ── 3. CORS ─────────────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite requisições sem origin (Postman, curl, apps mobile)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origem não autorizada: ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      credentials: true,
    })
  );

  // ── 4-5. Parse de body ───────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── 6. Log HTTP ──────────────────────────────────────────
  const morganFormat =
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat));

  // ── 7. Rotas da API ──────────────────────────────────────
  app.use('/api/v1', routes);

  // ── 8. 404 para rotas não mapeadas ──────────────────────
  app.use(notFoundHandler);

  // ── 9. Handler global de erros (deve ser ÚLTIMO) ────────
  app.use(errorHandler);

  return app;
}