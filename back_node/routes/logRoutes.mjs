// routes/logRoutes.mjs
import { Router } from 'express';
import { createLog, getLogs } from '../controllers/logController.mjs';
import logRateLimiter from '../middleware/rateLimiter.mjs';
import adminOnly from '../middleware/adminOnly.mjs';

const router = Router();

// 🔹 Публичный эндпоинт: запись лога (с защитой от спама)
router.post('/logs', logRateLimiter, createLog);

// 🔐 Защищённый эндпоинт: просмотр логов (только с IP или по токену)
// Для примера — только с локального IP
router.get('/logs', adminOnly, getLogs);

export default router;