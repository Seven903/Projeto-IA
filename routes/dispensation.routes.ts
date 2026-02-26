// src/routes/dispensation.routes.ts
// ============================================================
// Rotas de dispensação de medicamentos.
//
//   POST /api/v1/dispensations           → nurse, pharmacist, superadmin
//   POST /api/v1/dispensations/check     → nurse, pharmacist, superadmin
//   GET  /api/v1/dispensations/:id       → nurse, pharmacist, superadmin
//
// Toda dispensação passa pelo middleware auditDispensation que
// garante que um AuditLog de DISPENSE_ATTEMPT seja sempre criado
// antes de qualquer processamento, mesmo que a requisição falhe.
//
// IMPORTANTE: /check deve vir ANTES de /:id.
// ============================================================

import { Router } from 'express';
import { DispensationController } from '../controllers/dispensation.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { auditDispensation } from '../middlewares/auditLogger.middleware';

const router = Router();
const controller = new DispensationController();

router.use(requireAuth);
router.use(requireRole('nurse', 'pharmacist', 'superadmin'));

// Pré-verificação de alergia sem dispensar (estático antes de /:id)
router.post('/check', (req, res) => controller.checkAllergy(req, res));

// Dispensação — passa pelo middleware de auditoria de tentativa
router.post('/', auditDispensation, (req, res) => controller.dispense(req, res));

// Consulta de dispensação por ID
router.get('/:id', (req, res) => controller.getById(req, res));

export default router;