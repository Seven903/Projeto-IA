// src/routes/report.routes.ts
// ============================================================
// Rotas de Business Intelligence e relatórios.
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
router.get('/dashboard',             (req, res) => controller.getDashboard(req, res));
router.get('/heatmap',               (req, res) => controller.getHeatmap(req, res));
router.get('/medications/abc',       (req, res) => controller.getMedicationAbc(req, res));
router.get('/allergies/coverage',    (req, res) => controller.getAllergyCoverage(req, res));
router.get('/attendances/by-day',    (req, res) => controller.getAttendancesByDay(req, res));
router.get('/attendances/by-status', (req, res) => controller.getAttendancesByStatus(req, res));

// ── Auditoria — apenas superadmin ────────────────────────────
router.get(
  '/audit',
  requireRole('superadmin'),
  (req, res) => controller.getAuditLog(req, res)
);

export default router;