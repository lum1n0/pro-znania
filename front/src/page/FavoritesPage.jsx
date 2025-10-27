import React, { useEffect, useState } from 'react';
import { profileAPI } from '../api/apiServese';
import { Link, useLocation } from "react-router-dom";
import '../style/FavoritesPage.css';

const NAV_BUTTONS = [
    { to: "/profile", label: "Профиль" },
    { to: "/my/requests", label: "Мои заявки" },
    { to: "/my/articles", label: "Мои работы" },
    { to: "/favorites", label: "Закреплённые" },
];

export default function FavoritesPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await profileAPI.getFavorites();
                if (mounted) setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Не удалось загрузить закреплённое:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    if (loading) {
        return (
            <div className="favorites-container">
                <div className="favorites-loading">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="favorites-container">


            <div className="profile-nav">
                {NAV_BUTTONS.map(btn => (
                    <Link
                        key={btn.to}
                        to={btn.to}
                        className={
                            "profile-nav-btn" +
                            (location.pathname === btn.to ? " active" : "")
                        }
                    >
                        {btn.label}
                    </Link>
                ))}
            </div>


            <h2 className="favorites-title">Закреплённые статьи</h2>

            {items.length === 0 ? (
                <div className="favorites-empty">
                    <svg className="favorites-empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p>Список закреплённых пуст</p>
                    <span className="favorites-empty-hint">Добавьте статьи в избранное, чтобы быстро находить их здесь</span>
                </div>
            ) : (
                <ul className="favorites-list">
                    {items.map((f, index) => (
                        <Link
                            key={f.id}
                            to={`/article/${f.article.id}`}
                            className="favorites-item-link"
                            style={{ animationDelay: `${index * 0.08}s` }}
                        >
                            <li className="favorites-item">
                                <div className="favorites-item-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                                    </svg>
                                </div>
                                <div className="favorites-item-content">
                                    <span className="favorites-item-title">
                                        {f.article.title}
                                    </span>
                                    <span className="favorites-item-date">
                                        Добавлено: {new Date(f.createdAt).toLocaleDateString('ru-RU', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                    </span>
                                </div>
                            </li>
                        </Link>
                    ))}
                </ul>
            )}
        </div>
    );
}
