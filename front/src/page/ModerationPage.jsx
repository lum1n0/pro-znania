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
    <div className="mod-container">
      <h1 className="mod-title">Модерация</h1>

      <div className="mod-list">
        {sortedPending.map(p => {
          const isOpen = expanded.has(p.id);
          const full = details[p.id]; // детальные данные (после открытия)
          const descriptionDelta = full?.description ?? p.description; // если в pending уже есть — используем
          const html = deltaToHtml(descriptionDelta);

          return (
            <div key={p.id} className={`mod-card ${isOpen ? 'open' : ''}`}>
              <div className="mod-card-head" onClick={() => toggleExpand(p.id)}>
                <div className="mod-head-left">
                  <span className="mod-action">
                    Действие: <span className="mod-accent">{actionLabel(p.action)}</span>
                  </span>
                  <span className={statusClass()}>{statusLabel()}</span>
                </div>
                <div className="mod-head-right">
                  <span className="mod-title-line">
                    Заголовок: <span className="mod-accent">{p.title}</span>
                  </span>
                  <span className="mod-category">
                    Категория: <span className="mod-accent">{categoryName(p.categoryId)}</span>
                  </span>
                  <span className="mod-author">
                    Автор: <span className="mod-accent">{p.authorEmail}</span>
                  </span>
                  <span className="mod-date">
                    Создано: {new Date(p.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="mod-content">
<div className="mod-meta">
  {full?.authorName && (
    <div className="mod-meta-row">
      <b>Имя автора:</b> <span>{full.authorName}</span>
    </div>
  )}

  {Array.isArray(full?.videoPath) && (
    <div className="mod-meta-row">
      <b>Видео:</b>{' '}
      <span>{full.videoPath.length > 0 ? 'Приложен' : 'Не приложен'}</span>
    </div>
  )}

  {Array.isArray(full?.filePath) && (
    <div className="mod-meta-row">
      <b>Файлы:</b>{' '}
      <span>{full.filePath.length > 0 ? 'Приложен' : 'Не приложен'}</span>
    </div>
  )}
</div>


                  <div
                    className="mod-description html-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                  />

                  <div className="mod-actions">
                    <div className="mod-approve">
                      <label>Комментарий к одобрению (необязательно)</label>
                      <input
                        value={approveCommentById[p.id] || ''}
                        onChange={e =>
                          setApproveCommentById(prev => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                      <button className="btn btn-approve" onClick={() => approve(p.id)}>
                        Одобрить
                      </button>
                    </div>

                    <div className="mod-reject">
                      <label>Причина отклонения (обязательно)</label>
                      <input
                        value={rejectReasonById[p.id] || ''}
                        onChange={e =>
                          setRejectReasonById(prev => ({ ...prev, [p.id]: e.target.value }))
                        }
                      />
                      <button className="btn btn-reject" onClick={() => reject(p.id)}>
                        Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
