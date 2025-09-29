// middleware/rateLimiter.mjs
import rateLimit from 'express-rate-limit';

const logRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов
  message: {
    error: 'Слишком много запросов к логам. Попробуйте позже.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '::1' || req.ip === '127.0.0.1', // исключить localhost
});

export default logRateLimiter;