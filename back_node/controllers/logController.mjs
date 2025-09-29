// controllers/logController.mjs
import LogEntry from '../models/LogEntry.mjs';
import cron from 'node-cron';

// Удаление логов старше 1 месяца
const deleteOldLogs = async () => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  try {
    const result = await LogEntry.deleteMany({ timestamp: { $lt: oneMonthAgo } });
    console.log(`[LOG CLEANUP] Удалено ${result.deletedCount} логов старше 1 месяца`);
  } catch (err) {
    console.error('[LOG CLEANUP ERROR] Не удалось удалить старые логи:', err);
  }
};

// Каждый день в 02:00
cron.schedule('0 2 * * *', async () => {
  console.log('[LOG CLEANUP] Запуск удаления старых логов...');
  await deleteOldLogs();
});

// Запуск чистки при старте
deleteOldLogs().catch(console.error);

// Создание лога: нормализуем userEmail и userId
const createLog = async (req, res) => {
  try {
    const { level, message, action, userId, userEmail, meta = {} } = req.body;

    if (!level || !message || !action) {
      return res.status(400).json({ error: 'Поля level, message и action обязательны' });
    }

    const normalizedEmail =
      (typeof userEmail === 'string' && userEmail.trim()) ||
      (typeof meta.userEmail === 'string' && meta.userEmail.trim()) ||
      'guest';

    const normalizedUserId =
      userId != null ? String(userId) : meta.userId != null ? String(meta.userId) : null;

    const log = new LogEntry({
      level,
      message,
      action,
      userId: normalizedUserId,
      userEmail: normalizedEmail,
      meta,
    });

    await log.save();
    res.status(201).json({ success: true, id: log._id });
  } catch (err) {
    console.error('[LOG ERROR]', err);
    res.status(500).json({ error: 'Не удалось сохранить лог', details: err.message });
  }
};

// Получение логов: фильтр по email и обратная совместимость
const getLogs = async (req, res) => {
  try {
    // Поддерживаем 0-based page из фронта
    const page0 = Math.max(0, parseInt(req.query.page ?? '0', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20', 10)));

    const { action, userId, userEmail, level, startDate, endDate } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (level) filter.level = level;

    // Для userId
    if (userId && userId.trim()) {
      const strId = String(userId.trim());
      filter.$or = filter.$or || [];
      filter.$or.push({ userId: strId }, { 'meta.userId': strId });
    }

    // Для userEmail
    if (userEmail && userEmail.trim()) {
      const regex = new RegExp(userEmail.trim(), 'i');
      filter.$or = filter.$or || [];
      filter.$or.push({ userEmail: regex }, { 'meta.userEmail': regex });
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = page0 * limit;

    const [raw, total] = await Promise.all([
      LogEntry.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      LogEntry.countDocuments(filter),
    ]);

    // Гарантируем поля userEmail и userId для старых документов
    const logs = (raw || []).map((doc) => ({
      ...doc,
      userEmail: doc.userEmail || (doc.meta && doc.meta.userEmail) || 'guest',
      userId: doc.userId || (doc.meta && doc.meta.userId) || null,
    }));

    res.json({
      success: true,
      logs,
      pagination: {
        page: page0 + 1, // чтобы не ломать текущий UI
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[LOG ERROR]', err);
    res.status(500).json({ error: 'Ошибка получения логов', message: err.message });
  }
};

export { createLog, getLogs, deleteOldLogs };
