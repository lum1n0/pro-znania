// src/page/AdminPage.jsx
import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../style/AdminPage.css';
import { MdEditNotifications } from "react-icons/md";

const AdminPage = () => {
  const { hasRole } = useAuthStore();

  const isAdmin = hasRole('ADMIN');
  const isWriter = hasRole('WRITER');
  const isModerator = hasRole('MODERATOR');

  // Теперь доступ разрешён ADMIN, WRITER и MODERATOR
  if (!isAdmin && !isWriter && !isModerator) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-page">
      <div className="container">
        <header className="admin-header">
          <h1>
            {isWriter && !isAdmin && !isModerator
              ? 'Панель редактора'
              : 'Админ-панель'}
          </h1>
          <p>
            {isWriter && !isAdmin && !isModerator
              ? 'Доступные инструменты управления контентом'
              : 'Выберите раздел для управления системой'}
          </p>
        </header>

        <div className="admin-grid">
          {/* Управление пользователями — только для ADMIN */}
          {isAdmin && (
            <Link to="/admin/users" className="admin-card users">
              <div className="card-icon">
                <i className="fas fa-users"></i>
              </div>
              <h3>Управление пользователями</h3>
              <p>Добавление, редактирование и удаление пользователей</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

          {/* Управление категориями — для ADMIN и WRITER */}
          {(isAdmin || isWriter) && (
            <Link to="/admin/categories" className="admin-card categories">
              <div className="card-icon">
                <i className="fas fa-th-large"></i>
              </div>
              <h3>Управление категориями</h3>
              <p>Создание и редактирование категорий контента</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

          {/* Роли и права доступа — для ADMIN и WRITER */}
          {(isAdmin || isWriter) && (
            <Link to="/admin/access-roles" className="admin-card roles">
              <div className="card-icon">
                <i className="fas fa-user-shield"></i>
              </div>
              <h3>Роли и права доступа</h3>
              <p>Настройка прав и разрешений для пользователей</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

          {/* Обратная связь — только для ADMIN */}
          {isAdmin && (
            <Link to="/admin/feedback" className="admin-card feedback">
              <div className="card-icon">
                <i className="fas fa-comments"></i>
              </div>
              <h3>Обратная связь</h3>
              <p>Просмотр и обработка сообщений пользователей</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

          {/* Просмотр логов — только для ADMIN */}
          {isAdmin && (
            <Link to="/admin/logs" className="admin-card logs">
              <div className="card-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <h3>Просмотр логов</h3>
              <p>Анализ действий пользователей и ошибок системы</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

          {/* Новое: Модерация — для ADMIN и MODERATOR */}
          {(isAdmin || isModerator) && (
            <Link to="/moderation" className="admin-card moderation">
              <div className="card-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <h3>Модерация</h3>
              <p>Очередь заявок: одобрение и отклонение статей</p>
              <span className="card-arrow">
                <i className="fas fa-arrow-right"></i>
              </span>
            </Link>
          )}

            {(isAdmin || isModerator) && (
                <Link to="/admin/Invoice" className="admin-card invoice">
                    <div className="card-icon">
                        <MdEditNotifications />
                    </div>
                    <h3>Рассылка</h3>
                    <p>Отправка Рассылки пользователям</p>
                    <span className="card-arrow">
                        <i className="fas fa-arrow-right"></i>
                    </span>
                </Link>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
