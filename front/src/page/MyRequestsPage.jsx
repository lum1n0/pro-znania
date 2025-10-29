// src/pages/MyRequestsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { myWorkAPI, categoryAPI } from '../api/apiServese.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import '../style/MyRequestsPage.css';

const NAV_BUTTONS = [
    { to: "/profile", label: "Профиль" },
    { to: "/my/requests", label: "Мои заявки" },
    { to: "/my/articles", label: "Мои работы" },
    { to: "/favorites", label: "Закреплённые" },
];

const deltaToHtml = (delta) => {
    try {
        const d = typeof delta === 'string' ? JSON.parse(delta) : delta;
        if (d && Array.isArray(d.ops)) {
            return d.ops.map(op => (typeof op.insert === 'string' ? op.insert.replace(/\n/g, '<br>') : '')).join('');
        }
    } catch {}
    return typeof delta === 'string' ? delta : '';
};

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
        case 'PENDING': return 'myrequest-badge pending';
        case 'APPROVED': return 'myrequest-badge approved';
        case 'REJECTED': return 'myrequest-badge rejected';
        default: return 'myrequest-badge';
    }
};

export default function MyRequestsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(() => new Set());
    const [categoryMap, setCategoryMap] = useState({});

    const toggleExpand = (id) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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

    // Фильтруем только заявки (proposals)
    const requests = useMemo(() => {
        return items.filter(item => item.action === 'CREATE' || item.action === 'UPDATE');
    }, [items]);

    const sortedRequests = useMemo(() => {
        const rank = { PENDING: 0, REJECTED: 1, APPROVED: 2 };
        return [...requests].sort((a, b) => {
            const r = (rank[a.status] ?? 99) - (rank[b.status] ?? 99);
            if (r !== 0) return r;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }, [requests]);

    const openInEditor = (p) => {
        const preset = {
            title: p.title,
            description: deltaToHtml(p.description),
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

    if (loading) {
        return (
            <div className="myrequest-container">
                <div className="myrequest-loading">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="myrequest-container">
            <div className="profile-nav">
                {NAV_BUTTONS.map(btn => (
                    <Link
                        key={btn.to}
                        to={btn.to}
                        className={"profile-nav-btn" + (location.pathname === btn.to ? " active" : "")}
                    >
                        {btn.label}
                    </Link>
                ))}
            </div>

            <h2 className="myrequest-title">Мои заявки</h2>

            {sortedRequests.length === 0 ? (
                <div className="myrequest-empty">
                    <p>У вас пока нет заявок</p>
                </div>
            ) : (
                <div className="myrequest-list">
                    {sortedRequests.map(p => {
                        const isOpen = expanded.has(p.id);
                        return (
                            <div key={p.id} className={`myrequest-card ${isOpen ? 'open' : ''}`}>
                                <div className="myrequest-card-head" onClick={() => toggleExpand(p.id)}>
                                    <div className="myrequest-head-left">
                                        <span className="myrequest-action">{actionLabel(p.action)}</span>
                                        <span className={statusClass(p.status)}>{statusLabel(p.status)}</span>
                                    </div>
                                    <div className="myrequest-head-right">
                                        <h4 className="myrequest-content-title">{p.title}</h4>
                                        <span className="myrequest-category">{categoryName(p.categoryId)}</span>

                                        <span className="myrequest-date">
                      {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="myrequest-content">

                                        <div
                                            className="myrequest-description"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(deltaToHtml(p.description)) }}
                                        />

                                        {(Array.isArray(p.filePath) && p.filePath.length > 0) && (
                                            <div className="myrequest-attachments">
                                                <h5 className="myrequest-attachments-title">
                                                    <svg className="myrequest-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <path d="M13 2V9H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                    Прикрепленные файлы
                                                </h5>
                                                <div className="myrequest-file-grid">
                                                    {p.filePath.map((file, idx) => {
                                                        const fileName = file.split('/').pop();
                                                        const fileExt = fileName.split('.').pop().toUpperCase();
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={file}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="myrequest-file-card"
                                                            >
                                                                <div className="myrequest-file-icon">
                                                                    <span className="myrequest-file-ext">{fileExt}</span>
                                                                </div>
                                                                <div className="myrequest-file-info">
                                                                    <span className="myrequest-file-name" title={fileName}>{fileName}</span>
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {(Array.isArray(p.videoPath) && p.videoPath.length > 0) && (
                                            <div className="myrequest-attachments">
                                                <h5 className="myrequest-attachments-title">
                                                    <svg className="myrequest-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M23 7L16 12L23 17V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <path d="M14 5H3C1.89543 5 1 5.89543 1 7V17C1 18.1046 1.89543 19 3 19H14C15.1046 19 16 18.1046 16 17V7C16 5.89543 15.1046 5 14 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                    Прикрепленные видео
                                                </h5>
                                                <div className="myrequest-file-grid">
                                                    {p.videoPath.map((video, idx) => {
                                                        const videoName = video.split('/').pop();
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={video}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="myrequest-file-card myrequest-video-card"
                                                            >
                                                                <div className="myrequest-file-icon myrequest-video-icon">
                                                                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                                        <path d="M8 5V19L19 12L8 5Z"/>
                                                                    </svg>
                                                                </div>
                                                                <div className="myrequest-file-info">
                                                                    <span className="myrequest-file-name" title={videoName}>{videoName}</span>
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}



                                        {p.status === 'REJECTED' && p.rejectReason && (
                                            <div className="myrequest-reason">
                                                <strong>Причина отклонения:</strong> {p.rejectReason}
                                            </div>
                                        )}
                                        {p.status === 'REJECTED' && (
                                            <button
                                                className="myrequest-edit-btn"
                                                onClick={() => openInEditor(p)}
                                            >
                                                Редактировать
                                            </button>
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
