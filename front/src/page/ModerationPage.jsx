// src/pages/ModerationPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { moderationAPI, categoryAPI } from '../api/apiServese';
import { showSuccess, showError } from '../utils/toastUtils';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import '../style/ModerationPage.css'

// Перевод действия
const actionLabel = (a) => {
  switch (a) {
    case 'CREATE': return 'создание';
    case 'UPDATE': return 'обновление';
    default: return a?.toLowerCase();
  }
};

// Всегда pending на этой странице
const statusLabel = () => 'на модерации';

// Бейдж
const statusClass = () => 'mod-badge pending';

// Простой рендер Quill Delta -> HTML (как в других местах)
const deltaToHtml = (delta) => {
  try {
    const d = typeof delta === 'string' ? JSON.parse(delta) : delta;
    if (d && Array.isArray(d.ops)) {
      return d.ops
        .map(op => (typeof op.insert === 'string' ? op.insert.replace(/\n/g, '<br/>') : ''))
        .join('');
    }
  } catch {
    // игнорируем — вернём строку ниже
  }
  return typeof delta === 'string' ? delta : '';
};

export default function ModerationPage() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  // набор раскрытых карточек
  const [expanded, setExpanded] = useState(() => new Set());

  // кэш детальных данных заявок id -> data
  const [details, setDetails] = useState({});

  // поля комментариев/причин отдельно по id
  const [approveCommentById, setApproveCommentById] = useState({});
  const [rejectReasonById, setRejectReasonById] = useState({});

  // кэш категорий id -> имя
  const [categoryMap, setCategoryMap] = useState({});

  const toggleExpand = async (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // При открытии — догружаем детали, если нет
    if (!details[id]) {
      try {
        const { data } = await moderationAPI.getProposal(id);
        setDetails(prev => ({ ...prev, [id]: data || {} }));
      } catch (e) {
        console.error(e);
        showError?.('Не удалось открыть заявку');
      }
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await moderationAPI.listPending();
      setPending(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      showError?.('Не удалось загрузить очередь модерации');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Подгружаем названия категорий
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await categoryAPI.getAllCategories(0, 2000);
        const content = data?.content || data || [];
        const map = {};
        content.forEach(c => {
          if (c?.id != null) map[c.id] = c.description ?? `Категория #${c.id}`;
        });
        if (mounted) setCategoryMap(map);
      } catch (e) {
        console.error('Не удалось загрузить категории:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const categoryName = (id) => categoryMap?.[id] ?? `Категория #${id}`;

  const sortedPending = useMemo(() => {
    // Свежие выше
    return [...pending].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [pending]);

  const approve = async (id) => {
    try {
      const comment = approveCommentById[id] || '';
      await moderationAPI.approve(id, comment);
      // Очистим локальные состояния по заявке
      setApproveCommentById(prev => { const c = { ...prev }; delete c[id]; return c; });
      setRejectReasonById(prev => { const c = { ...prev }; delete c[id]; return c; });
      setDetails(prev => { const c = { ...prev }; delete c[id]; return c; });
      setExpanded(prev => { const next = new Set(prev); next.delete(id); return next; });
      await load();
      showSuccess?.('Заявка одобрена');
    } catch (e) {
      console.error(e);
      showError?.('Ошибка при одобрении');
    }
  };

  const reject = async (id) => {
    const reason = (rejectReasonById[id] || '').trim();
    if (!reason) {
      showError?.('Укажите причину отклонения');
      return;
    }
    try {
      await moderationAPI.reject(id, reason);
      setApproveCommentById(prev => { const c = { ...prev }; delete c[id]; return c; });
      setRejectReasonById(prev => { const c = { ...prev }; delete c[id]; return c; });
      setDetails(prev => { const c = { ...prev }; delete c[id]; return c; });
      setExpanded(prev => { const next = new Set(prev); next.delete(id); return next; });
      await load();
      showSuccess?.('Заявка отклонена');
    } catch (e) {
      console.error(e);
      showError?.('Ошибка при отклонении');
    }
  };

  if (loading) return <div className="mod-loading">Загрузка…</div>;

    return (
        <div className="mod2-root">
            <div className="mod2-table-side">
                <div className="mod2-title">Модерация</div>
                <table className="mod2-table">
                    <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Почта</th>
                        <th>Статья</th>
                        <th>Статус</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedPending.map((row) => (
                        <tr
                            key={row.id}
                            className={expanded.has(row.id) ? "selected" : ""}
                            onClick={() => toggleExpand(row.id)}
                        >
                            <td>
                                <div className="mod2-user">
                                    {row.authorName || 'John Deo'}
                                </div>
                            </td>
                            <td>{row.authorEmail}</td>
                            <td>{row.title}</td>
                            <td>
                <span className={
                    row.status === "PENDING"
                        ? "badge badge-pending"
                        : row.status === "APPROVED"
                            ? "badge badge-ok"
                            : row.status === "REJECTED"
                                ? "badge badge-rejected"
                                : ""
                }>
                  {row.status === "PENDING" && "На рассмотрении"}
                    {row.status === "APPROVED" && "Одобрено"}
                    {row.status === "REJECTED" && "Отклонено"}
                </span>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Правая панель. Рисуется для каждой раскрытой заявки (supports multi-panel expand) */}
            {[...expanded].map((id) => {
                const detail = details[id] || {};
                return (
                    <div className="mod2-panel-side" key={id}>
                        <div className="mod2-panel-header">
                            <div className="mod2-panel-title">Запрос на создание</div>
                            <button className="mod2-panel-close" onClick={() => toggleExpand(id)}>×</button>
                        </div>
                        <label>
                            Заголовок
                            <input className="mod2-panel-input" disabled value={detail.title || ""} />
                        </label>
                        <label>
                            Описание
                            <textarea
                                className="mod2-panel-input"
                                disabled
                                value={
                                    typeof detail.description === 'string'
                                        ? detail.description
                                        : (detail.description?.ops?.map(op => op.insert)?.join('') || "")
                                }
                            />
                        </label>
                        <label>
                            Категория
                            <input
                                className="mod2-panel-input"
                                disabled
                                value={categoryMap[detail.categoryId] || ""}
                            />
                        </label>
                        <div className="mod2-panel-meta">
                            {detail.createdAt && (
                                <span>{new Date(detail.createdAt).toLocaleString('ru-RU')}</span>
                            )}
                        </div>

                        <label>
                            Комментарий
                            <input
                                className="mod2-panel-input"
                                placeholder="Комментарий"
                                value={approveCommentById[id] || rejectReasonById[id] || ""}
                                onChange={e => {
                                    setApproveCommentById(prev => ({ ...prev, [id]: e.target.value }));
                                    setRejectReasonById(prev => ({ ...prev, [id]: e.target.value }));
                                }}
                            />
                        </label>
                        <button
                            className="mod2-approve-btn"
                            style={{ background: '#dcfeeb' }}
                            onClick={() => approve(id)}
                        >
                            Одобрить
                        </button>
                        <button
                            className="mod2-reject-btn"
                            style={{ background: '#ffd6df' }}
                            onClick={() => reject(id)}
                        >
                            Отклонить
                        </button>
                    </div>
                );
            })}
        </div>
  );
}
