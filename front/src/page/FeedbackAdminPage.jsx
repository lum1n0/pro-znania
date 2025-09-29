// pages/FeedbackAdminPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { feedbackAPI } from '../api/apiServese';
import { showSuccess, showError } from '../utils/toastUtils';
import ConfirmationModal from '../component/ConfirmationModal';
import '../style/FeedbackAdminPage.css';

const FeedbackAdminPage = () => {
  const { user, hasRole } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isAdmin = hasRole('ADMIN');

  useEffect(() => {
    if (!isAdmin) return;
    fetchFeedbacks();
  }, [page, isAdmin]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await feedbackAPI.getAllFeedback(page, 10);
      setFeedbacks(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Ошибка при загрузке отзывов:', err);
      showError('Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (feedbackId, currentStatus) => {
    const action = currentStatus ? 'снять ответ' : 'отметить как отвечено';
    const feedbackItem = feedbacks.find(f => f.id === feedbackId);

    setConfirmModal({
      isOpen: true,
      title: `Подтвердите действие`,
      message: `Вы уверены, что хотите ${action} для отзыва "${feedbackItem.title}"?`,
      onConfirm: async () => {
        setUpdatingStatus(prev => ({ ...prev, [feedbackId]: true }));
        try {
          await feedbackAPI.updateFeedbackStatus(feedbackId, !currentStatus);
          setFeedbacks(prevFeedbacks =>
            prevFeedbacks.map(feedback =>
              feedback.id === feedbackId
                ? { ...feedback, isAnswered: !currentStatus }
                : feedback
            )
          );
          showSuccess(`Статус отзыва "${feedbackItem.title}" обновлён`);
          await fetchFeedbacks(); // Перезагрузка для сортировки
        } catch (err) {
          console.error('Ошибка при изменении статуса:', err);
          showError('Не удалось изменить статус отзыва');
        } finally {
          setUpdatingStatus(prev => ({ ...prev, [feedbackId]: false }));
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      },
    });
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) setPage(page + 1);
  };

  const handlePrevPage = () => {
    if (page > 0) setPage(page - 1);
  };

  if (!user) return <div className="loading">Загрузка...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="feedback-admin-page">
          <p>У вас нет прав доступа к этой странице.</p>
        </div>
      </div>
    );
  }

  // FeedbackAdminPage.jsx (обновлённые классы)
// FeedbackAdminPage.jsx (обновлённые классы)
return (
  <div className="feedback-admin-container">
    <div className="feedback-admin-page">
      <h1>Управление отзывами</h1>
      {loading ? (
        <div className="feedback-admin-loading">Загрузка отзывов...</div>
      ) : feedbacks.length === 0 ? (
        <div className="feedback-admin-no-feedback">Нет отзывов</div>
      ) : (
        <table className="feedback-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Заголовок</th>
              <th>Описание</th>
              <th>Почта пользователя</th>
              <th>Статья</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((feedback) => (
              <tr key={feedback.id} className={feedback.isAnswered ? 'feedback-admin-row--answered' : 'feedback-admin-row--unanswered'}>
                <td>{feedback.id}</td>
                <td className="feedback-admin-title">{feedback.title}</td>
                <td className="feedback-admin-desc">{feedback.description}</td>
                <td>{feedback.userEmail}</td>
                <td>{feedback.articleTitle}</td>
                <td>
                  <span className={`feedback-admin-status-badge ${feedback.isAnswered ? 'feedback-admin-status-badge--answered' : 'feedback-admin-status-badge--unanswered'}`}>
                    {feedback.isAnswered ? 'Отвечено' : 'Нет_ответа'}
                  </span>
                </td>
                <td>
                  <button
                    className={`feedback-admin-status-button ${feedback.isAnswered ? 'feedback-admin-status-button--unanswered' : 'feedback-admin-status-button--answered'}`}
                    onClick={() => handleStatusChange(feedback.id, feedback.isAnswered)}
                    disabled={updatingStatus[feedback.id]}
                  >
                    {updatingStatus[feedback.id] ? 'Обновление...' :
                     feedback.isAnswered ? 'Снять ответ' : 'Отметить как отвечено'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="feedback-admin-pagination">
        <button onClick={handlePrevPage} disabled={page === 0}>
          Предыдущая
        </button>
        <span className='pages'>
          Страница {page + 1} из {totalPages}
        </span>
        <button onClick={handleNextPage} disabled={page >= totalPages - 1}>
          Следующая
        </button>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  </div>
);
};

export default FeedbackAdminPage;