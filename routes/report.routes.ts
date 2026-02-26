// src/routes/report.routes.ts
// ============================================================
// Rotas de Business Intelligence e relatórios.
//
// Todos os endpoints retornam dados anonimizados.
// Acessíveis por qualquer role autenticado, exceto /audit
// que é restrito a superadmin.
//
//   GET /api/v1/reports/dashboard              → todos os roles
//   GET /api/v1/reports/heatmap                → todos os roles
//   GET /api/v1/reports/medications/abc        → todos os roles
//   GET /api/v1/reports/allergies/coverage     → todos os roles
//   GET /api/v1/reports/attendances/by-day     → todos os roles
//   GET /api/v1/reports/attendances/by-status  → todos os roles
//   GET /api/v1/reports/audit                  → superadmin apenas
// ============================================================

import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();
const controller = new ReportController();

router.use(requireAuth);

// ── Relatórios anonimizados — todos os roles ─────────────────
router.get('/dashboard', (req, res) => controller.dashboard(req, res));
router.get('/heatmap', (req, res) => controller.heatmap(req, res));
router.get('/medications/abc', (req, res) => controller.medicationAbcCurve(req, res));
router.get('/allergies/coverage', (req, res) => controller.allergyCoverage(req, res));
router.get('/attendances/by-day', (req, res) => controller.attendancesByDay(req, res));
router.get('/attendances/by-status', (req, res) => controller.attendancesByStatus(req, res));

// ── Auditoria — apenas superadmin ────────────────────────────
router.get(
  '/audit',
  requireRole('superadmin'),
  (req, res) => controller.auditLog(req, res)
);

export default router;