// src/page/ProfilePage.jsx
import React, { useEffect, useState } from 'react';
import { profileAPI, writerPermissionsAPI } from '../api/apiServese';
import { useAuthStore } from '../store/authStore';
import { Link, useLocation } from "react-router-dom";
import "../style/ProfilePage.css";

const NAV_BUTTONS = [
    { to: "/profile", label: "Профиль" },
    { to: "/my/requests", label: "Мои заявки" },
    { to: "/my/articles", label: "Мои работы" },
    { to: "/favorites", label: "Закреплённые" },
];

export default function ProfilePage() {
    const { hasRole } = useAuthStore();
    const [me, setMe] = useState(null);
    const [editableCategories, setEditableCategories] = useState([]);
    const [loadingMe, setLoadingMe] = useState(true);
    const [loadingPerms, setLoadingPerms] = useState(false);
    const location = useLocation();

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await profileAPI.getMyData();
                if (mounted) setMe(data);
            } catch (e) {
                console.error('Не удалось загрузить профиль:', e);
            } finally {
                if (mounted) setLoadingMe(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!hasRole('WRITER')) return;
        let mounted = true;
        setLoadingPerms(true);
        (async () => {
            try {
                const { data } = await writerPermissionsAPI.getEditableCategories();
                if (mounted) setEditableCategories(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Не удалось загрузить редактируемые категории:', e);
            } finally {
                if (mounted) setLoadingPerms(false);
            }
        })();
        return () => { mounted = false; };
    }, [hasRole]);

    return (
        <div className="profile-container">
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

            <h2 className="profile-title">Мой профиль</h2>

            {loadingMe ? (
                <div className="profile-loading">
                    <div className="spinner"></div>
                    <span>Загрузка профиля...</span>
                </div>
            ) : me ? (
                <div className="profile-content">
                    {/* Блок: Основная информация */}
                    <div className="profile-card profile-info-card">
                        <div className="profile-card-header">
                            <svg className="profile-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <h3 className="profile-card-title">Основная информация</h3>
                        </div>
                        <div className="profile-card-body">
                            <div className="profile-info-grid">
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Имя:</span>
                                    <span className="profile-info-value">{me.firstName}</span>
                                </div>
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Фамилия:</span>
                                    <span className="profile-info-value">{me.lastName}</span>
                                </div>
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Email:</span>
                                    <span className="profile-info-value">{me.email}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Блок: Роли и доступы */}
                    <div className="profile-card profile-roles-card">
                        <div className="profile-card-header">
                            <svg className="profile-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 15C15.866 15 19 11.866 19 8C19 4.13401 15.866 1 12 1C8.13401 1 5 4.13401 5 8C5 11.866 8.13401 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8.21 13.89L7 23L12 20L17 23L15.79 13.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <h3 className="profile-card-title">Роли и доступы</h3>
                        </div>
                        <div className="profile-card-body">
                            <div className="profile-badge-group">
                <span className="profile-badge profile-badge-primary">
                  {me.roleDto?.title || 'Пользователь'}
                </span>
                                {(me.accessRolesDto || []).map((r, idx) => (
                                    <span key={idx} className="profile-badge profile-badge-secondary">
                    {r.title}
                  </span>
                                ))}
                            </div>
                            {(me.accessRolesDto || []).length === 0 && (
                                <p className="profile-empty-text">Дополнительные доступы не назначены</p>
                            )}
                        </div>
                    </div>

                    {/* Блок: Редактируемые категории (только для Writer) */}
                    {hasRole('WRITER') && (
                        <div className="profile-card profile-categories-card">
                            <div className="profile-card-header">
                                <svg className="profile-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <h3 className="profile-card-title">Редактируемые категории</h3>
                            </div>
                            <div className="profile-card-body">
                                {loadingPerms ? (
                                    <div className="profile-loading-inline">
                                        <div className="spinner-small"></div>
                                        <span>Загрузка...</span>
                                    </div>
                                ) : editableCategories.length === 0 ? (
                                    <p className="profile-empty-text">Нет доступных категорий</p>
                                ) : (
                                    <ul className="profile-category-list">
                                        {editableCategories.map(c => (
                                            <li key={c.id} className="profile-category-item">
                                                {c.description || `Категория #${c.id}`}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="profile-card profile-error-card">
                    <p>Не удалось загрузить данные профиля</p>
                </div>
            )}
        </div>
    );
}
