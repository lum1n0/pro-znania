// src/pages/MyArticlesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { myWorkAPI, categoryAPI } from '../api/apiServese.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import '../style/MyWorkPage.css';

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

export default function MyArticlesPage() {
    const location = useLocation();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoryMap, setCategoryMap] = useState({});

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

    // Собираем все уникальные одобренные статьи
    const articles = useMemo(() => {
        // Группируем по articleId, чтобы избежать дублей
        const articleMap = new Map();

        items.forEach(item => {
            // Берем только записи с articleId (это означает, что статья существует)
            if (item.articleId != null) {
                const existing = articleMap.get(item.articleId);

                // Если статья уже есть, берем запись с более поздней датой или со статусом APPROVED
                if (!existing ||
                    item.status === 'APPROVED' ||
                    new Date(item.createdAt) > new Date(existing.createdAt)) {
                    articleMap.set(item.articleId, item);
                }
            }
        });

        // Возвращаем только одобренные статьи
        return Array.from(articleMap.values()).filter(article => article.status === 'APPROVED');
    }, [items]);

    const sortedArticles = useMemo(() => {
        return [...articles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [articles]);

    if (loading) {
        return (
            <div className="myarticle-container">
                <div className="myarticle-loading">
                    <div className="spinner"></div>
                    <span>Загрузка...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="myarticle-container">
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

            <h2 className="myarticle-title">Мои работы</h2>

            {sortedArticles.length === 0 ? (
                <div className="myarticle-empty">
                    <svg className="myarticle-empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p>У вас пока нет опубликованных статей</p>
                </div>
            ) : (
                <div className="myarticle-list">
                    {sortedArticles.map(article => (
                        <Link
                            key={article.articleId}
                            to={`/article/${article.articleId}`}
                            className="myarticle-card-link"
                        >
                            <div className="myarticle-card">
                                <div className="myarticle-card-header">
                                    <h3 className="myarticle-card-title">{article.title}</h3>
                                    <span className="myarticle-category">{categoryName(article.categoryId)}</span>
                                </div>
                                <div
                                    className="myarticle-excerpt"
                                    dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(deltaToHtml(article.description).substring(0, 200) + '...')
                                    }}
                                />
                                <div className="myarticle-card-footer">
                  <span className="myarticle-date">
                    Опубликовано: {new Date(article.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
