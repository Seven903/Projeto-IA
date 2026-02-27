// src/routes/attendance.routes.ts
// ============================================================
// Rotas de atendimentos clínicos na enfermaria.
//
//   GET  /api/v1/attendances             → nurse, pharmacist, superadmin
//   GET  /api/v1/attendances/open        → nurse, pharmacist, superadmin
//   POST /api/v1/attendances             → nurse, pharmacist, superadmin
//   GET  /api/v1/attendances/:id         → nurse, pharmacist, superadmin
//   PUT  /api/v1/attendances/:id/close   → nurse, pharmacist, superadmin
//
// IMPORTANTE: a rota /open deve vir ANTES de /:id para que o
// Express não interprete "open" como um parâmetro de rota UUID.
// ============================================================

import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

const router = Router();
const controller = new AttendanceController();

// Todas as rotas exigem autenticação e role com acesso à saúde
router.use(requireAuth);
router.use(requireRole('nurse', 'pharmacist', 'superadmin'));

// IMPORTANTE: rotas estáticas antes das dinâmicas (:id)
router.get('/open', (req, res) => controller.listOpen(req, res));

router.get('/', (req, res) => controller.list(req, res));
router.post('/', (req, res) => controller.open(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.put('/:id/close', (req, res) => controller.close(req, res));

export default router;