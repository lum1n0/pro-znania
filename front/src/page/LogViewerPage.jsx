// src/pages/LogViewerPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Navigate } from 'react-router-dom';
import { userAPI } from '../api/apiServese';
import '../style/LogViewerPage.css';

const actionLabels = {
  ARTICLE_CREATE: 'Создание статьи',
  UPDATE_ARTICLE: 'Редактирование статьи',
  ARTICLE_HARD_DELETED: 'Удаление статьи',
  FETCH_CATEGORIES_FAIL: 'Ошибка загрузки категорий',
  CREATE_USER: 'Создание пользователя',
  UPDATE_USER: 'Обновление пользователя',
  FEEDBACK_SUBMITTED: 'Отправка обратной связи',
  ARTICLE_UPDATE_SUCCESS: 'Успешное обновление статьи',
  ARTICLE_LOAD_FAIL: 'Ошибка загрузки статьи',
  ARTICLE_UPDATE_FAILED: 'Ошибка обновления статьи',
  ARTICLE_CREATE_FAIL: 'Ошибка создания статьи',
  FEEDBACK_SEND_FAIL: 'Ошибка отправки обратной связи',
  VIDEO_LOAD_FAIL: 'Ошибка загрузки видео',
  MESSAGE_SENT: 'Сообщение отправлено',
  CHAT_INITIALIZED: 'Чат успешно инициализирован',
  PDF_DOWNLOADED: 'PDF статьи успешно скачан',
  ARTICLE_LOADED: 'Статья успешно загружена',
  CHAT_INIT_FAIL: 'Ошибка инициализации чата',
  // Добавьте свои действия
};

const actionOptions = [
  { value: '', label: 'Все действия' },
  { value: 'ARTICLE_CREATE', label: 'Создание статьи' },
  { value: 'UPDATE_ARTICLE', label: 'Редактирование статьи' },
  { value: 'ARTICLE_HARD_DELETED', label: 'Удаление статьи' },
  { value: 'FETCH_CATEGORIES_FAIL', label: 'Ошибка загрузки категорий' },
  { value: 'CREATE_USER', label: 'Создание пользователя' },
  { value: 'UPDATE_USER', label: 'Обновление пользователя' },
  { value: 'FEEDBACK_SUBMITTED', label: 'Отправка обратной связи' },
  { value: 'ARTICLE_UPDATE_SUCCESS', label: 'Успешное обновление статьи' },
  { value: 'ARTICLE_LOAD_FAIL', label: 'Ошибка загрузки статьи' },
  { value: 'ARTICLE_UPDATE_FAILED', label: 'Ошибка обновления статьи' },
  { value: 'ARTICLE_CREATE_FAIL', label: 'Ошибка создания статьи' },
  { value: 'CHAT_INIT_FAIL', label: 'Ошибка инициализации чата' },
  { value: 'MESSAGE_SENT', label: 'Сообщение отправлено' },
  { value: 'VIDEO_LOAD_FAIL', label: 'Ошибка загрузки видео' },
  { value: 'FEEDBACK_SEND_FAIL', label: 'Ошибка отправки обратной связи' },
  { value: 'CHAT_INITIALIZED', label: 'Чат успешно инициализирован' },
  { value: 'PDF_DOWNLOADED', label: 'PDF статьи успешно скачан' },
  { value: 'ARTICLE_LOADED', label: 'Статья успешно загружена' },
];

const LogViewerPage = () => {
  const { hasRole } = useAuthStore();
  const [logs, setLogs] = useState([]);
  const [userEmails, setUserEmails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    level: '',
    userEmail: '',
    startDate: '',
    endDate: '',
    timeRange: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  const isAdmin = hasRole('ADMIN');

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, filters, pagination.page]);

  useEffect(() => {
    const loadMissingEmails = async () => {
      const missingIds = new Set();
      logs.forEach((log) => {
        const userId = String(log.userId || log.meta?.userId || '');
        if (userId && !userEmails[userId] && log.userEmail === 'guest') {
          missingIds.add(userId);
        }
      });

      if (missingIds.size > 0) {
        const promises = Array.from(missingIds).map(async (id) => {
          try {
            const response = await userAPI.getUserById(id);
            setUserEmails((prev) => ({ ...prev, [id]: response.data.email }));
          } catch (err) {
            console.error(`Ошибка загрузки пользователя ${id}:`, err);
            setUserEmails((prev) => ({ ...prev, [id]: 'Неизвестный пользователь' }));
          }
        });
        await Promise.all(promises);
      }
    };

    if (logs.length > 0) {
      loadMissingEmails();
    }
  }, [logs]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      let userIdFilter = '';
      if (filters.userEmail) {
        try {
          const response = await userAPI.getUserByEmail(filters.userEmail.trim().toLowerCase());
          userIdFilter = response.data.id;
        } catch (err) {
          console.error('Пользователь не найден:', err);
          setLogs([]);
          setPagination((prev) => ({ ...prev, total: 0 }));
          setLoading(false);
          return;
        }
      }

      // Обработка временных фильтров
      let startDate = '';
      let endDate = '';

      if (filters.timeRange !== 'all') {
        const now = new Date();
        switch (filters.timeRange) {
          case 'today':
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            startDate = todayStart.toISOString();
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);
            endDate = todayEnd.toISOString();
            break;
          case 'yesterday':
            const yesterdayStart = new Date(now);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);
            yesterdayStart.setHours(0, 0, 0, 0);
            startDate = yesterdayStart.toISOString();
            const yesterdayEnd = new Date(yesterdayStart);
            yesterdayEnd.setHours(23, 59, 59, 999);
            endDate = yesterdayEnd.toISOString();
            break;
          case 'lastWeek':
            const lastWeek = new Date(now);
            lastWeek.setDate(lastWeek.getDate() - 7);
            startDate = lastWeek.toISOString();
            endDate = new Date().toISOString();
            break;
          case 'lastHour':
            const lastHour = new Date(now);
            lastHour.setHours(lastHour.getHours() - 1);
            startDate = lastHour.toISOString();
            endDate = new Date().toISOString();
            break;
          case 'custom':
            if (filters.startDate) {
              startDate = new Date(filters.startDate).toISOString();
            }
            if (filters.endDate) {
              endDate = new Date(filters.endDate).toISOString();
            }
            break;
          default:
            startDate = '';
            endDate = '';
        }
      }

      // Формирование параметров запроса
      const params = new URLSearchParams();
      params.append('page', (pagination.page - 1).toString());
      params.append('limit', pagination.limit.toString());

      // Добавляем фильтры только если они заданы
      if (filters.action) {
        params.append('action', filters.action);
      }
      if (filters.level) {
        params.append('level', filters.level);
      }
      if (userIdFilter) {
        params.append('userId', userIdFilter);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      console.log('Отправляемые параметры:', Object.fromEntries(params)); // Для отладки

// В функции fetchLogs замените хардкодный URL:
const response = await fetch(`/logger/api/logs?${params.toString()}`, {
  headers: {
    'x-api-key': 'SECRET_KEY_123',
  },
});

      if (!response.ok) throw new Error('Ошибка загрузки логов');

      const data = await response.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setPagination((prev) => ({ 
        ...prev, 
        total: data.pagination?.total || 0,
      }));
    } catch (err) {
      console.error('Ошибка загрузки логов:', err);
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    
    // Если меняется тип временного диапазона, сбрасываем кастомные даты
    if (name === 'timeRange' && value !== 'custom') {
      setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }));
    }
    
    // Сбрасываем на первую страницу при изменении фильтров
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const handleResetFilters = () => {
    setFilters({
      action: '',
      level: '',
      userEmail: '',
      startDate: '',
      endDate: '',
      timeRange: 'all',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= Math.ceil(pagination.total / pagination.limit)) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="log-viewer-page">
      <div className="container">
        <div className="page-header">
          <h1>Просмотр логов системы</h1>
        </div>

        <form onSubmit={handleSearch} className="filters-form">
          <div className="filter-group">
            <label htmlFor="action">Действие:</label>
            <select
              id="action"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
            >
              {actionOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="level">Уровень:</label>
            <select
              id="level"
              name="level"
              value={filters.level}
              onChange={handleFilterChange}
            >
              <option value="">Все уровни</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
              <option value="DEBUG">Debug</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="userEmail">Email пользователя:</label>
            <input
              type="text"
              id="userEmail"
              name="userEmail"
              value={filters.userEmail}
              onChange={handleFilterChange}
              placeholder="Введите email"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="timeRange">Временной диапазон:</label>
            <select
              id="timeRange"
              name="timeRange"
              value={filters.timeRange}
              onChange={handleFilterChange}
            >
              <option value="all">Все время</option>
              <option value="today">Сегодня</option>
              <option value="yesterday">Вчера</option>
              <option value="lastWeek">Последняя неделя</option>
              <option value="lastHour">Последний час</option>
              <option value="custom">Выбрать диапазон</option>
            </select>
          </div>

          {filters.timeRange === 'custom' && (
            <div className="date-filters">
              <div className="filter-group">
                <label htmlFor="startDate">С даты:</label>
                <input
                  type="datetime-local"
                  id="startDate"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="endDate">По дату:</label>
                <input
                  type="datetime-local"
                  id="endDate"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
          )}

          <div className="filter-actions">
            <button type="submit" className="btn-primary">Поиск</button>
            <button type="button" className="btn-secondary" onClick={handleResetFilters}>
              Сбросить фильтры
            </button>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}

        <div className="logs-table-container">
          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Уровень</th>
                  <th>Действие</th>
                  <th>Сообщение</th>
                  <th>Статья</th>
                  <th>Email пользователя</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log, index) => {
                    const articleId = log.meta?.articleId;
                    const articleTitle = log.meta?.articleTitle;
                    const actionLabel = actionLabels[log.action] || log.action;
                    const userIdToUse = String(log.userId || log.meta?.userId || '');
                    const userEmailToDisplay = log.userEmail && log.userEmail !== 'guest'
                      ? log.userEmail
                      : (userIdToUse ? userEmails[userIdToUse] || 'Загрузка...' : '—');

                    return (
                      <tr key={log._id || index}>
                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`badge level-${log.level?.toLowerCase() || 'info'}`}>
                            {log.level || 'INFO'}
                          </span>
                        </td>
                        <td><code>{actionLabel}</code></td>
                        <td>{log.message}</td>
                        <td>
                          {articleId ? (
                            <div>
                              <strong>{articleTitle || 'Без названия'}</strong>
                              <br />
                              <small>ID: {articleId}</small>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{userEmailToDisplay}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="no-logs">Логи не найдены</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {logs.length > 0 && pagination.total > pagination.limit && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              ← Предыдущая
            </button>
            <span>
              Страница {pagination.page} из {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
            </span>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            >
              Следующая →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewerPage;