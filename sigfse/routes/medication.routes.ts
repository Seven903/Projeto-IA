// src/routes/medication.routes.ts
// ============================================================
// Rotas de medicamentos e controle de estoque.
//
//   GET  /api/v1/medications                     → todos os roles
//   POST /api/v1/medications                     → pharmacist, superadmin
//   GET  /api/v1/medications/:id                 → todos os roles
//   PUT  /api/v1/medications/:id                 → pharmacist, superadmin
//   GET  /api/v1/medications/:id/batches         → todos os roles
//   POST /api/v1/medications/:id/batches         → pharmacist, superadmin
//   GET  /api/v1/stock/alerts                    → todos os roles
// ============================================================

import { Router } from 'express';
import { MedicationController } from '../controllers/medication.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();
const controller = new MedicationController();

router.use(requireAuth);

// ── Medicamentos ─────────────────────────────────────────────
router.get('/', (req, res) => controller.list(req, res));

router.post(
  '/',
  requireRole('pharmacist', 'superadmin'),
  (req, res) => controller.create(req, res)
);

router.get('/:id', (req, res) => controller.getById(req, res));

// ── Lotes ────────────────────────────────────────────────────
router.post(
  '/:id/batches',
  requireRole('pharmacist', 'superadmin'),
  (req, res) => controller.receiveBatch(req, res)
);

// ── Alertas de estoque ───────────────────────────────────────
router.get('/stock/alerts', (req, res) => controller.getStockAlerts(req, res));

export default router;