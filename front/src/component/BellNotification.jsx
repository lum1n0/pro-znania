import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { Bell } from 'lucide-react';
import '../style/BellNotifucation.css';

export default function BellNotification() {
    const {
        notifications,
        unreadCount,
        fetchNotifications,
        fetchUnreadCount,
        isLoading,
        markAsRead,
        markAllAsRead
    } = useNotificationStore();

    const [open, setOpen] = useState(false);
    const [modal, setModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const ref = useRef();
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
        fetchUnreadCount();

        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleBellClick = () => setOpen(!open);

    const handleRead = async (id) => await markAsRead(id);

    const handleReadAll = async () => await markAllAsRead();

    // главное изъятие: берем articleId из объекта уведомления!
    const handleOpenModal = (notif) => {
        console.log('Клик по уведомлению:', notif);

        // если есть articleId — переходи на статью
        if (notif.articleId) {
            navigate(`/article/${notif.articleId}`);
            setOpen(false);
            if (!notif.isRead) {
                markAsRead(notif.id);
            }
        } else {
            setSelected(notif);
            setModal(true);
        }
    };

    const handleCloseModal = () => {
        setModal(false);
        setSelected(null);
    };

    const unreadInList = notifications.filter(n => !n.isRead).length;

    return (
        <div className="bell-notification-wrapper" ref={ref}>
            <div className="bell-icon" onClick={handleBellClick}>
                <Bell size={28} />
                {unreadInList > 0 && (
                    <span className="notification-badge notification-badge-dot"></span>
                )}
            </div>

            {open && (
                <div className="notification-dropdown">
                    <div className="notification-dropdown-header">
                        <span className="notification-title">Уведомления</span>
                        <div className="notification-counts">
                            <span className="notification-count-all">
                                {unreadInList} непроч. / {notifications.length} всего
                            </span>
                            {unreadInList > 0 && (
                                <button className="btn-mark-read-all" onClick={handleReadAll}>
                                    Прочитать все
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="notification-list">
                        {isLoading ? (
                            <div className="notification-empty">Загрузка...</div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">Нет уведомлений</div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    className={`notification-item${n.isRead ? ' read' : ''}`}
                                    onClick={() => handleOpenModal(n)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="notification-content">
                                        <strong>{n.title}</strong>
                                        <div>
                                            {n.message.length > 150
                                                ? n.message.slice(0, 150) + '...'
                                                : n.message
                                            }
                                        </div>
                                        <span className="notification-date">
                                            {new Date(n.createdAt).toLocaleString('ru-RU')}
                                        </span>
                                    </div>
                                    {!n.isRead && (
                                        <button
                                            className="btn-mark-read"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRead(n.id);
                                            }}
                                        >
                                            Прочитано
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Модальное окно */}
            {modal && selected && (
                <div className="notification-modal" onClick={handleCloseModal}>
                    <div className="notification-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>{selected.title}</h2>
                        <div className="notification-modal-text">
                            {selected.message}
                        </div>
                        <div className="notification-modal-date">
                            {new Date(selected.createdAt).toLocaleString('ru-RU')}
                        </div>
                        <button className="btn-close-modal" onClick={handleCloseModal}>
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
