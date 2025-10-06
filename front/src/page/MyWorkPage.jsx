// src/pages/MyWorkPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { myWorkAPI, categoryAPI } from '../api/apiServese';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import '../style/MyWorkPage.css';

// Простая конвертация Quill Delta -> плоский HTML
const deltaToHtml = (delta) => {
  try {
    const d = typeof delta === 'string' ? JSON.parse(delta) : delta;
    if (d && Array.isArray(d.ops)) {
      return d.ops
        .map(op => (typeof op.insert === 'string' ? op.insert.replace(/\n/g, '<br/>') : ''))
        .join('');
    }
  } catch {
    // игнорируем, вернём исходную строку ниже
  }
  return typeof delta === 'string' ? delta : '';
};

// Переводы действия/статуса
const actionLabel = (a) => {
  switch (a) {
    case 'CREATE': return 'создание';
    case 'UPDATE': return 'обновление';
    default: return a?.toLowerCase();
  }
};
const statusLabel = (s) => {
  switch (s) {
    case 'PENDING': return 'на модерации';
    case 'APPROVED': return 'одобрено';
    case 'REJECTED': return 'отклонено';
    default: return s?.toLowerCase();
  }
};
const statusClass = (s) => {
  switch (s) {
    case 'PENDING': return 'mywork-badge pending';
    case 'APPROVED': return 'mywork-badge approved';
    case 'REJECTED': return 'mywork-badge rejected';
    default: return 'mywork-badge';
  }
};

export default function MyWorkPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // раскрытые карточки
  const [expanded, setExpanded] = useState(() => new Set());

  // кэш категорий: id -> имя
  const [categoryMap, setCategoryMap] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // данные «Мои работы»
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await myWorkAPI.getMyWork();
        if (mounted) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // список категорий для отображения имен
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

  const sortedItems = useMemo(() => {
    const rank = { PENDING: 0, REJECTED: 1, APPROVED: 2 };
    return [...items].sort((a, b) => {
      const r = (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
      if (r !== 0) return r;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [items]);

  // открыть в редакторе (для REJECTED)
  const openInEditor = (p) => {
    const preset = {
      title: p.title,
      description: deltaToHtml(p.description), // HTML-строка
      categoryId: String(p.categoryId),
      files: p.filePath || [],
      videoPath: p.videoPath || [],
      fromProposalId: p.id,
    };
    try {
      sessionStorage.setItem('editorPreset', JSON.stringify(preset));
    } catch (e) {
      console.warn('Не удалось сохранить preset в sessionStorage:', e);
    }
    if (p.action === 'CREATE' || p.articleId == null) {
      navigate(`/create-article?categoryId=${p.categoryId}`, { state: { preset } });
    } else {
      navigate(`/article/${p.articleId}/edit`, { state: { preset } });
    }
  };

  if (loading) return <div className="mywork-loading">Загрузка…</div>;

  return (
    <div className="mywork-container">
      <h1 className="mywork-title">Мои работы</h1>

      {/* Пустой список */}
      {sortedItems.length === 0 ? (
        <div className="mywork-empty">У вас нет статей</div>
      ) : (
        <div className="mywork-list">
          {sortedItems.map(p => {
            const isOpen = expanded.has(p.id);
            const html = deltaToHtml(p.description);

            return (
              <div key={p.id} className={`mywork-card ${isOpen ? 'open' : ''}`}>
                <div className="mywork-card-head" onClick={() => toggleExpand(p.id)}>
                  <div className="mywork-head-left">
                    <span className="mywork-action">
                      Действие: <span className="mywork-accent">{actionLabel(p.action)}</span>
                    </span>
                    <span className={statusClass(p.status)}>{statusLabel(p.status)}</span>
                    {p.rejectReason && (
                      <span className="mywork-reason">Комментарий: {p.rejectReason}</span>
                    )}
                  </div>
                  <div className="mywork-head-right">
                    <span className="mywork-title-line">
                      Заголовок: <span className="mywork-accent">{p.title}</span>
                    </span>
                    <span className="mywork-category">
                      Категория: <span className="mywork-accent">{categoryName(p.categoryId)}</span>
                    </span>
                    <span className="mywork-date">
                      Создано: {new Date(p.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="mywork-content">
                    <div
                      className="mywork-description html-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                    />

                    <div className="mywork-attachments">
  <div className="mywork-files">
    <div className="mywork-subtitle">Файлы:</div>
    {Array.isArray(p?.filePath) && p.filePath.length > 0 ? (
      <div>Приложен</div>
    ) : (
      <div className="mywork-dash">Не приложен</div>
    )}
  </div>

  <div className="mywork-video">
    <div className="mywork-subtitle">Видео:</div>
    {Array.isArray(p?.videoPath) && p.videoPath.length > 0 ? (
      <div>Приложен</div>
    ) : (
      <div className="mywork-dash">Не приложен</div>
    )}
  </div>
</div>


                    {p.status === 'REJECTED' && (
                      <div className="mywork-actions">
                        <button
                          className="btn btn-primary"
                          onClick={() => openInEditor(p)}
                          title="Открыть редактор с содержимым отклонённой заявки"
                        >
                          Открыть в редакторе
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
