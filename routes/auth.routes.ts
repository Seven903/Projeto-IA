// src/routes/auth.routes.ts
// ============================================================
// Rotas de autenticação.
//
// Públicas  (sem JWT):
//   POST /api/v1/auth/login
//
// Protegidas (requer JWT válido):
//   POST /api/v1/auth/logout
//   GET  /api/v1/auth/me
// ============================================================

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

// Público — não exige token
router.post('/login', (req, res) => controller.login(req, res));

// Protegidas — exige token válido
router.post('/logout', requireAuth, (req, res) => controller.logout(req, res));
router.get('/me', requireAuth, (req, res) => controller.me(req, res));

export default router;