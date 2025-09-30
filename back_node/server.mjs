// server.mjs
import express from 'express';
import cors from 'cors';
import logRoutes from './routes/logRoutes.mjs';
import connectDB from './config/db_connect.mjs';
const app = express();
const PORT = 3001;

// Подключение к MongoDB
await connectDB();

// CORS: только с фронтенда
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://pro-znania.llc.tagras.corp:4200'],
    credentials: false,
  })
);

// Парсинг JSON
app.use(express.json({ limit: '10kb' })); // логи не должны быть огромными

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[LOGGER] ${req.method} ${req.path} ← ${req.headers.origin || 'unknown'}`);
  next();
});

// Публичный API для логов
app.use('/api', logRoutes);

// Статус-эндпоинт
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'logger', timestamp: new Date().toISOString() });
});

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`✅ Сервис логирования запущен на порту ${PORT}`);
  console.log(`➡️  Принимает логи с http://localhost:4200`);
  console.log(`📊 Логи сохраняются в MongoDB (logs_db.logs)`);
  console.log(`🛡️  Rate limit: 100 за 15 мин с одного IP`);
});