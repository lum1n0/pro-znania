import express from 'express';
import cors from 'cors';
import logRoutes from './routes/logRoutes.mjs';
import connectDB from './config/db_connect.mjs';

const app = express();
const PORT = 3001;

await connectDB();

// Обновляем CORS для обоих доменов
app.use(
  cors({
    origin: [
      'http://localhost:4200', 
      'http://pro-znania:4200',
      'http://pro-znania.llc.tagras.corp:4200'
    ],
    credentials: false,
  })
);

app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  console.log(`[LOGGER] ${req.method} ${req.path} ← ${req.headers.origin || 'unknown'}`);
  next();
});

app.use('/api', logRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'logger', timestamp: new Date().toISOString() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`✅ Сервис логирования запущен на порту ${PORT}`);
  console.log(`➡️  Принимает логи с http://localhost:4200, http://pro-znania:4200, http://pro-znania.llc.tagras.corp:4200`);
  console.log(`📊 Логи сохраняются в MongoDB (logs_db.logs)`);
});