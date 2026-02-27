// src/routes/index.ts
// ============================================================
// Agregador central de todas as rotas da API.
//
// Monta todas as sub-rotas sob o prefixo /api/v1.
// Também expõe o endpoint de health-check público.
//
// Mapa completo de rotas:
//
//   /api/v1/health               → GET  (público)
//   /api/v1/auth/*               → login, logout, me
//   /api/v1/students/*           → CRUD estudantes + prontuário + alergias
//   /api/v1/medications/*        → CRUD medicamentos + lotes
//   /api/v1/attendances/*        → atendimentos clínicos
//   /api/v1/dispensations/*      → dispensação de medicamentos
//   /api/v1/reports/*            → BI, heatmap, curva ABC, auditoria
// ============================================================

import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import studentRoutes from './student.routes';
import medicationRoutes from './medication.routes';
import attendanceRoutes from './attendance.routes';
import dispensationRoutes from './dispensation.routes';
import reportRoutes from './report.routes';

const router = Router();

// ── Health-check público ─────────────────────────────────────
// Usado por load balancers, Docker healthcheck e monitoramento.
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'SIGFSE',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── Sub-rotas da API ─────────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/medications', medicationRoutes);
router.use('/attendances', attendanceRoutes);
router.use('/dispensations', dispensationRoutes);
router.use('/reports', reportRoutes);

// ── Rota 404 para endpoints não mapeados ─────────────────────
router.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint não encontrado. Verifique a URL e o método HTTP.',
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

export default router;