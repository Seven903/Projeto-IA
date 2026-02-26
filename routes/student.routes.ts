// src/routes/student.routes.ts
// ============================================================
// Rotas de estudantes e dados de saúde.
//
// Todas as rotas exigem JWT válido (requireAuth).
// Rotas de saúde exigem role com canAccessHealthData.
//
//   GET    /api/v1/students                           → todos os roles
//   GET    /api/v1/students/search                    → todos os roles
//   POST   /api/v1/students                           → nurse, pharmacist, superadmin
//   GET    /api/v1/students/:id                       → todos os roles
//   PUT    /api/v1/students/:id                       → nurse, pharmacist, superadmin
//   GET    /api/v1/students/:id/health                → nurse, pharmacist, superadmin
//   PUT    /api/v1/students/:id/health                → nurse, pharmacist, superadmin
//   GET    /api/v1/students/:id/allergies             → nurse, pharmacist, superadmin
//   POST   /api/v1/students/:id/allergies             → nurse, pharmacist, superadmin
//   DELETE /api/v1/students/:id/allergies/:algId      → nurse, pharmacist, superadmin
// ============================================================

import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { auditAccess } from '../middlewares/auditLogger.middleware';

const router = Router();
const controller = new StudentController();

// Todas as rotas exigem autenticação
router.use(requireAuth);

// ── Listagem e busca ─────────────────────────────────────────
router.get('/', (req, res) => controller.list(req, res));
router.get('/search', (req, res) => controller.search(req, res));

// ── CRUD de dados demográficos ───────────────────────────────
router.post(
  '/',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.create(req, res)
);

router.get('/:id', (req, res) => controller.getById(req, res));

router.put(
  '/:id',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.update(req, res)
);

// ── Prontuário eletrônico — acesso restrito ──────────────────
router.get(
  '/:id/health',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  auditAccess,
  (req, res) => controller.getHealthProfile(req, res)
);

router.put(
  '/:id/health',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.updateHealthRecord(req, res)
);

// ── Alergias ─────────────────────────────────────────────────
router.get(
  '/:id/allergies',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.getHealthProfile(req, res)
);

router.post(
  '/:id/allergies',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.addAllergy(req, res)
);

router.delete(
  '/:id/allergies/:algId',
  requireRole('nurse', 'pharmacist', 'superadmin'),
  (req, res) => controller.removeAllergy(req, res)
);

export default router;