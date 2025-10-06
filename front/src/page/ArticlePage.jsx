import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { writerPermissionsAPI } from '../api/apiServese';
import { logAction } from '../api/logClient';
import { ApiClient } from '../api/apiClient';
import Cookies from 'js-cookie';
import { showSuccess, showError } from '../utils/toastUtils';
import ConfirmationModal from '../component/ConfirmationModal';
import '../style/ArticlePage.css';
import { articleVersionsAPI } from '../api/apiServese';
import { sanitizeHtml } from '../utils/sanitizeHtml';

const deltaToHtml = (delta) => {
  if (typeof delta === 'object' && delta.ops) {
    return delta.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('');
  } else if (typeof delta === 'string') {
    try {
      const parsed = JSON.parse(delta);
      return deltaToHtml(parsed);
    } catch {
      return delta;
    }
  }
  return '';
};

const ArticlePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const parallaxRef = useRef(null);
  const {
    selectedArticle,
    fetchArticleById,
    fetchGuestArticleById,
    softDeleteArticle,
    hardDeleteArticle,
    downloadArticlePdf,
    articleVersions,
    fetchArticleVersions,
    compareArticleVersion,
    compareResult,
    clearArticleVersions,
    fetchArticleVersion,
    selectedVersion,
    restoreArticleVersion,
    // --- Добавляем метод удаления версии из store ---
    deleteArticleVersion,
    // --- Конец добавления ---
  } = useArticleStore();
  const { user, isAuthenticated, hasRole } = useAuthStore();
  const userEmail = user?.email || user?.sub || 'guest';
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState({ title: '', description: '' });
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  // + новое состояние для автора выбранной версии
  const [versionAuthor, setVersionAuthor] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [canEditArticle, setCanEditArticle] = useState(false);

  // Состояния для версий
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [isViewingVersion, setIsViewingVersion] = useState(false);

  // Ref для кнопки дропдауна версий
  const versionButtonRef = useRef(null);
  // Ref для позиции дропдауна
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 250 });

  useEffect(() => {
    const loadVersionAuthor = async () => {
      if (isViewingVersion && selectedVersion && selectedArticle?.id) {
        try {
          const { data } = await articleVersionsAPI.getArticleVersionAuthor(
            selectedArticle.id,
            selectedVersion.version
          );
          setVersionAuthor(data || null);
        } catch (e) {
          console.error('Не удалось получить автора версии:', e);
          setVersionAuthor(null);
        }
      } else {
        setVersionAuthor(null);
      }
    };
    loadVersionAuthor();
  }, [isViewingVersion, selectedVersion, selectedArticle]);


  // Проверка прав доступа для WRITER
  useEffect(() => {
    const checkEditPermission = async () => {
      if (hasRole('ADMIN')) {
        setCanEditArticle(true);
        return;
      }
      if (hasRole('WRITER') && selectedArticle?.categoryDto?.id) {
        try {
          const response = await writerPermissionsAPI.canEditArticle(selectedArticle.categoryDto.id);
          setCanEditArticle(response.data === true);
        } catch (error) {
          console.error('Ошибка проверки прав доступа:', error);
          setCanEditArticle(false);
        }
        return;
      }
      setCanEditArticle(false);
    };
    if (selectedArticle && (hasRole('ADMIN') || hasRole('WRITER'))) {
      checkEditPermission();
    } else {
      setCanEditArticle(false);
    }
  }, [selectedArticle, user, hasRole]);

  // Загрузка статьи
  useEffect(() => {
    const loadArticle = async () => {
      setError(null);
      setVideoUrl(null);
      try {
        const action = isAuthenticated ? fetchArticleById : fetchGuestArticleById;
        const article = await action(id);
        if (!article) throw new Error('Статья не найдена или доступ запрещен');
        logAction('INFO', 'ARTICLE_LOADED', 'Статья успешно загружена', {
          articleId: id,
          articleTitle: article.title,
          userEmail,
        });
      } catch (err) {
        const errorMessage = err.message || 'Неизвестная ошибка';
        setError(errorMessage);
        logAction('ERROR', 'ARTICLE_LOAD_FAIL', 'Ошибка загрузки статьи', {
          articleId: id,
          error: errorMessage,
          userEmail,
        });
      }
    };
    if (id) loadArticle();
  }, [id, fetchArticleById, fetchGuestArticleById, isAuthenticated, user]);

  // Загрузка версий статьи
  useEffect(() => {
    const loadVersions = async () => {
      if (selectedArticle && (hasRole('ADMIN') || hasRole('WRITER'))) {
        try {
          const versions = await fetchArticleVersions(selectedArticle.id);
          console.log("Загруженные версии:", versions);
        } catch (error) {
          console.error('Ошибка загрузки версий:', error);
        }
      } else {
        clearArticleVersions();
      }
    };
    loadVersions();
  }, [selectedArticle, hasRole, fetchArticleVersions, clearArticleVersions]);

  const canEdit = hasRole('ADMIN') || hasRole('WRITER');
  const isOwnerOrAdmin = hasRole('ADMIN');

  // Загрузка видео
  useEffect(() => {
    let objectUrl = null;
    setVideoUrl(null);
    if (!selectedArticle || String(selectedArticle.id) !== String(id)) return;
    const loadVideo = async () => {
      if (!selectedArticle?.videoPath?.[0]) return;
      try {
        const response = await ApiClient.get(selectedArticle.videoPath[0], {
          responseType: 'blob',
        });
        objectUrl = URL.createObjectURL(response.data);
        setVideoUrl(objectUrl);
      } catch (err) {
        logAction('ERROR', 'VIDEO_LOAD_FAIL', 'Ошибка загрузки видео', {
          articleId: id,
          articleTitle: selectedArticle.title,
          videoPath: selectedArticle.videoPath[0],
          error: err.message,
          userEmail,
        });
      }
    };
    loadVideo();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedArticle, id, userEmail]);

  // Отправка отзыва
  // Отправка отзыва
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      showError('Пожалуйста, войдите в систему');
      logAction('WARN', 'FEEDBACK_NO_USER', 'Попытка отправить отзыв без авторизации', {
        articleId: id,
        userEmail,
      });
      return;
    }

    if (!selectedArticle?.title) {
      showError('Заголовок статьи не найден');
      return;
    }

    if (!feedback.title.trim() || !feedback.description.trim()) {
      showError('Заполните все поля');
      return;
    }

    const token = Cookies.get('authToken');
    if (!token) {
      showError('Токен отсутствует');
      logAction('ERROR', 'FEEDBACK_NO_TOKEN', 'Токен отсутствует при отправке отзыва', {
        articleId: id,
        articleTitle: selectedArticle.title,
        userEmail,
      });
      return;
    }

    try {
      const feedbackData = {
        title: feedback.title.trim(),
        description: feedback.description.trim(),
        articleId: Number(id) || selectedArticle.id,
        articleTitle: selectedArticle.title,
        pageUrl: window.location.pathname,
        userEmail,
      };

      // Готовим заголовки: JSON + Bearer при наличии токена
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Прямая отправка через ApiClient, чтобы гарантировать передачу заголовков
      await ApiClient.post('/api/feedback', feedbackData, { headers });

      logAction('INFO', 'FEEDBACK_SENT', 'Отзыв по статье отправлен', {
        articleId: id,
        articleTitle: selectedArticle.title,
        userEmail,
      });

      showSuccess('Спасибо! Отзыв отправлен');
      setIsFeedbackOpen(false);
      setFeedback({ title: '', description: '' });
    } catch (err) {
      // Нормализация текста ошибки
      let errorMsg = 'Unknown error';
      if (err.response) {
        const { status, data } = err.response;
        if (typeof data === 'string' && data.trim()) {
          errorMsg = data.trim();
        } else if (data?.message) {
          errorMsg = data.message;
        } else if (status) {
          errorMsg = `HTTP ${status}`;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      logAction('ERROR', 'FEEDBACK_SEND_FAIL', 'Ошибка отправки отзыва', {
        articleId: id,
        articleTitle: selectedArticle.title,
        error: errorMsg,
        userEmail,
      });
      showError('Не удалось отправить отзыв: ' + errorMsg);
    }
  };


  // Мягкое удаление/восстановление
  const handleDeleteRestore = async () => {
    if (!(hasRole('ADMIN') || (hasRole('WRITER') && canEditArticle))) {
      showError('У вас нет прав на редактирование статьи');
      return;
    }
    const newIsDelete = !selectedArticle.isDelete;
    const action = newIsDelete ? 'отключить' : 'восстановить';
    const title = selectedArticle.title;
    logAction('INFO', 'DELETE_RESTORE_ATTEMPT', `Попытка ${action}`, {
      articleId: id,
      articleTitle: title,
      userEmail,
    });
    setConfirmModal({
      isOpen: true,
      title: `Подтвердите ${action}`,
      message: `Вы уверены, что хотите ${action} статью "${title}"?`,
      onConfirm: async () => {
        try {
          const result = await softDeleteArticle(id, newIsDelete);
          if (result === true || (typeof result === 'object' && result !== null)) {
            logAction('INFO', newIsDelete ? 'ARTICLE_DELETED' : 'ARTICLE_RESTORED', `Статья ${newIsDelete ? 'отключена' : 'восстановлена'}`, {
              articleId: id,
              articleTitle: title,
              userEmail,
            });
            showSuccess(`Статья ${newIsDelete ? 'отключена' : 'восстановлена'}`);
          } else {
            throw new Error(`Не удалось ${newIsDelete ? 'отключить' : 'восстановить'} статью`);
          }
        } catch (err) {
          console.error(`Ошибка при ${newIsDelete ? 'отключении' : 'восстановлении'} статьи:`, err);
          logAction('ERROR', newIsDelete ? 'ARTICLE_DELETE_FAIL' : 'ARTICLE_RESTORE_FAIL', `Ошибка при ${newIsDelete ? 'отключении' : 'восстановлении'} статьи`, {
            articleId: id,
            articleTitle: title,
            userEmail,
            error: err.message || String(err)
          });
          showError(`Не удалось ${newIsDelete ? 'отключить' : 'восстановить'} статью: ${err.message || 'Неизвестная ошибка'}`);
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Полное удаление (hard delete)
  const handleHardDelete = async () => {
    if (!isOwnerOrAdmin) {
      showError('У вас нет прав на полное удаление статьи');
      logAction('WARN', 'HARD_DELETE_FORBIDDEN', 'Попытка полного удаления без прав администратора', {
        articleId: id,
        userEmail,
      });
      return;
    }
    if (!selectedArticle) {
      showError('Статья не загружена');
      return;
    }
    const title = selectedArticle.title;
    setConfirmModal({
      isOpen: true,
      title: 'Полное удаление статьи',
      message: `Вы уверены, что хотите полностью удалить статью "${title}"? Это действие нельзя отменить.`,
      onConfirm: async () => {
        try {
          const success = await hardDeleteArticle(id);
          console.log("Результат hardDeleteArticle:", success);
          if (success === true) {
            logAction('INFO', 'ARTICLE_HARD_DELETED', 'Статья полностью удалена', {
              articleId: id,
              articleTitle: title,
              userEmail,
            });
            showSuccess('Статья удалена навсегда');
            navigate('/'); // Перенаправление после удаления
          } else {
            throw new Error('Не удалось удалить статью');
          }
        } catch (err) {
          console.error('Ошибка при полном удалении статьи:', err);
          logAction('ERROR', 'ARTICLE_HARD_DELETE_FAIL', 'Ошибка при полном удалении статьи', {
            articleId: id,
            articleTitle: title,
            userEmail,
            error: err.message || String(err)
          });
          showError('Не удалось удалить статью: ' + (err.message || 'Неизвестная ошибка'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Скачивание PDF
  const handleDownloadPdf = async () => {
    if (!selectedArticle?.id) return;
    setIsPdfLoading(true);
    try {
      const success = await downloadArticlePdf(selectedArticle.id);
      if (success) {
        logAction('INFO', 'PDF_DOWNLOADED', 'PDF статьи успешно скачан', {
          articleId: selectedArticle.id,
          articleTitle: selectedArticle.title,
          userEmail,
        });
        showSuccess('PDF файл успешно скачан!');
      } else {
        logAction('ERROR', 'PDF_DOWNLOAD_FAIL', 'Ошибка скачивания PDF', {
          articleId: selectedArticle.id,
          articleTitle: selectedArticle.title,
          userEmail,
        });
        showError('Не удалось скачать PDF файл');
      }
    } catch (error) {
      logAction('ERROR', 'PDF_DOWNLOAD_ERROR', 'Ошибка при скачивании PDF', {
        articleId: selectedArticle.id,
        articleTitle: selectedArticle.title,
        error: error.message,
        userEmail,
      });
      showError('Ошибка при скачивании PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // --- Функция для просмотра версии ---
  const handleViewVersion = async (versionNum) => {
    if (!versionNum || !selectedArticle) return;
    try {
      await fetchArticleVersion(selectedArticle.id, versionNum);
      setIsViewingVersion(true);
      setShowComparison(false);
      setShowVersionDropdown(false); // Закрываем дропдаун после выбора
    } catch (error) {
      console.error("Ошибка загрузки версии для просмотра:", error);
      showError('Ошибка загрузки версии: ' + (error.response?.data?.message || error.message || 'Неизвестная ошибка'));
      setIsViewingVersion(false);
    }
  };

  // --- Функция для удаления версии ---
  const handleDeleteVersion = async (versionNum) => {
    if (!isOwnerOrAdmin) {
      showError('У вас нет прав на удаление версии статьи');
      logAction('WARN', 'VERSION_DELETE_FORBIDDEN', 'Попытка удаления версии без прав администратора', {
        articleId: id,
        userEmail,
      });
      return;
    }
    if (!versionNum || !selectedArticle) {
      showError('Версия или статья не загружены');
      return;
    }
    const title = selectedArticle.title;
    setConfirmModal({
      isOpen: true,
      title: 'Удаление версии статьи',
      message: `Вы уверены, что хотите удалить версию ${versionNum} статьи "${title}"? Это действие нельзя отменить.`,
      onConfirm: async () => {
        try {
          // Вызываем метод из store
          const success = await deleteArticleVersion(selectedArticle.id, versionNum);
          console.log("Результат deleteArticleVersion из store:", success);
          if (success === true) {
            logAction('INFO', 'ARTICLE_VERSION_DELETED', `Версия ${versionNum} статьи удалена`, {
              articleId: id,
              articleTitle: title,
              userEmail,
            });
            showSuccess(`Версия ${versionNum} удалена`);
            // Перезагрузим список версий - теперь вызов через store
            await fetchArticleVersions(selectedArticle.id);
            // Если удаляемая версия была текущей просматриваемой, выйдем из режима просмотра
            if (isViewingVersion && selectedVersion && selectedVersion.version === versionNum) {
              setIsViewingVersion(false);
            }
          } else {
            throw new Error('Не удалось удалить версию через store');
          }
        } catch (err) {
          console.error('Ошибка при удалении версии статьи:', err);
          logAction('ERROR', 'ARTICLE_VERSION_DELETE_FAIL', `Ошибка при удалении версии ${versionNum}`, {
            articleId: id,
            articleTitle: title,
            userEmail,
            error: err.message || String(err)
          });
          showError('Не удалось удалить версию: ' + (err.message || 'Неизвестная ошибка'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // --- Функция для сравнения текущей версии с просматриваемой ---
  const handleCompareWithCurrent = async () => {
    if (!isViewingVersion || !selectedVersion || !selectedArticle) {
      showError('Нет версии для сравнения.');
      return;
    }
    try {
      await compareArticleVersion(selectedArticle.id, selectedVersion.version);
      setShowComparison(true);
    } catch (error) {
      console.error("Ошибка сравнения версий:", error);
      console.error("Ошибка сравнения версий (детали):", error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Неизвестная ошибка при сравнении версий';
      showError('Ошибка сравнения версий: ' + errorMessage);
    }
  };

  // --- Функция для выхода из режима просмотра версии ---
  const handleExitViewVersion = () => {
    setIsViewingVersion(false);
    setShowComparison(false);
  };

  // --- УЛУЧШЕННАЯ ЛОГИКА ДЛЯ ПОЗИЦИОНИРОВАНИЯ ДРОПДАУНА ---
  const updateDropdownPosition = useCallback(() => {
    if (versionButtonRef.current && showVersionDropdown) {
      const buttonRect = versionButtonRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      setDropdownPosition({
        top: buttonRect.top + scrollTop,
        left: buttonRect.left + scrollLeft,
        width: buttonRect.width, // Используем ширину кнопки
      });
    }
  }, [showVersionDropdown]);

  // Обновляем позицию при открытии и при скролле/ресайзе
  useEffect(() => {
    if (showVersionDropdown) {
      updateDropdownPosition();
    }
  }, [showVersionDropdown, updateDropdownPosition]);

  useEffect(() => {
    if (showVersionDropdown) {
      const handleScrollResize = () => updateDropdownPosition();
      window.addEventListener('scroll', handleScrollResize);
      window.addEventListener('resize', handleScrollResize);
      return () => {
        window.removeEventListener('scroll', handleScrollResize);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
  }, [showVersionDropdown, updateDropdownPosition]);

  // --- Обработчик клика вне дропдауна ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showVersionDropdown) {
        // Проверяем, кликнули ли мы вне дропдауна и вне кнопки
        const dropdownElement = document.getElementById('version-dropdown-menu-portal');
        if (dropdownElement && !dropdownElement.contains(event.target) && !versionButtonRef.current?.contains(event.target)) {
          setShowVersionDropdown(false);
        }
      }
    };

    if (showVersionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVersionDropdown]);

  // Рендер описания
  const renderDescription = (description) => {
    if (isViewingVersion && selectedVersion) {
      const versionDescription = selectedVersion.description;
      const html = deltaToHtml(versionDescription);
      return (
        <div>
          {/* --- СТИЛИЗОВАННЫЙ БЛОК ИНФОРМАЦИИ О ВЕРСИИ --- */}
          <div className="version-info-bar">
            <strong>Просмотр версии {selectedVersion.version}</strong>
            <div className="version-info-buttons">
              <button onClick={handleCompareWithCurrent} className="btn btn-secondary version-info-btn" title="Сравнить с текущей версией">
                ↔️ Сравнить с текущей
              </button>
              <button onClick={handleExitViewVersion} className="btn btn-secondary version-info-btn" title="Вернуться к текущей версии">
                ← Вернуться к текущей
              </button>
            </div>
          </div>

          {/* --- КОНЕЦ СТИЛИЗОВАННОГО БЛОКА --- */}
          <div
            className="html-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
          />
          {/* >>> ВСТАВИТЬ СЮДА <<< */}
          {isViewingVersion && selectedVersion && (
            <div className="version-meta">
              <div className="version-badge">Версия v{selectedVersion.version}</div>
              <div className="version-author">
  Автор версии: {versionAuthor?.email || 'неизвестно'}
</div>
{versionAuthor?.name && (
  <div className="version-author-name">
    Имя: {versionAuthor.name}
  </div>
)}
<div className="version-date">
  Дата: {
    // пока сервер не отдаёт createdAt автора заявки — используем editedAt снимка
    selectedVersion?.editedAt
      ? new Date(selectedVersion.editedAt).toLocaleString()
      : 'неизвестно'
  }
</div>
            </div>
          )}

        </div>
      );
    }
    // УБРАНО: рендеринг модального окна сравнения из renderDescription
    const html = deltaToHtml(description);
    return (
      <div
        className="html-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  };

  // --- УЛУЧШЕННАЯ Функция для рендеринга сравнения версий ---
  const renderComparison = (compareResult) => {
    if (!compareResult) {
      return <div>Нет данных для сравнения.</div>;
    }
    const allChanges = [];
    console.log("Обработка descriptionTextDeltas:", compareResult.descriptionTextDeltas);
    if (compareResult.descriptionTextDeltas && Array.isArray(compareResult.descriptionTextDeltas)) {
      compareResult.descriptionTextDeltas.forEach((deltaChange, index) => {
        if (!deltaChange.type) {
          console.warn("Найдена запись изменения без типа:", deltaChange);
          return;
        }
        const sourceText = (deltaChange.source || '').trim();
        const targetText = (deltaChange.target || '').trim();
        if (deltaChange.type === 'INSERT') {
          if (targetText !== '') {
            allChanges.push({ type: 'ADDED', content: targetText, key: `insert-${index}` });
          }
        } else if (deltaChange.type === 'DELETE') {
          if (sourceText !== '') {
            allChanges.push({ type: 'REMOVED', content: sourceText, key: `delete-${index}` });
          }
        } else if (deltaChange.type === 'CHANGE') {
          if (sourceText !== '') {
            allChanges.push({ type: 'REMOVED', content: sourceText, key: `change-source-${index}` });
          }
          if (targetText !== '') {
            allChanges.push({ type: 'ADDED', content: targetText, key: `change-target-${index}` });
          }
        } else {
          console.warn("Неизвестный тип изменения:", deltaChange.type, deltaChange);
        }
      });
    }
    console.log("Обработка descriptionJsonPatch:", compareResult.descriptionJsonPatch);
    if (allChanges.length === 0 && compareResult.descriptionJsonPatch && Array.isArray(compareResult.descriptionJsonPatch)) {
      compareResult.descriptionJsonPatch.forEach((op, index) => {
        if (op.op === 'add') {
          allChanges.push({ type: 'ADDED', content: `Добавлено: ${op.value}`, key: `patch-add-${index}` });
        } else if (op.op === 'remove') {
          allChanges.push({ type: 'REMOVED', content: `Удалено: ${op.path}`, key: `patch-del-${index}` });
        } else if (op.op === 'replace') {
          allChanges.push({ type: 'ADDED', content: `Заменено: ${op.path} на: ${op.value}`, key: `patch-rep-${index}` });
        }
      });
    }
    if (allChanges.length === 0) {
      if (compareResult.titleChanged) {
        allChanges.push({ type: 'REMOVED', content: `Заголовок: ${compareResult.titleBefore}`, key: 'title-before' });
        allChanges.push({ type: 'ADDED', content: `Заголовок: ${compareResult.titleAfter}`, key: 'title-after' });
      }
      if (compareResult.categoryChanged) {
        allChanges.push({ type: 'REMOVED', content: `Категория: ${compareResult.categoryBeforeName}`, key: 'cat-before' });
        allChanges.push({ type: 'ADDED', content: `Категория: ${compareResult.categoryAfterName}`, key: 'cat-after' });
      }
      if (compareResult.filesDiff) {
        compareResult.filesDiff.added.forEach((file, index) => {
          allChanges.push({ type: 'ADDED', content: `Файл добавлен: ${file}`, key: `file-add-${index}` });
        });
        compareResult.filesDiff.removed.forEach((file, index) => {
          allChanges.push({ type: 'REMOVED', content: `Файл удален: ${file}`, key: `file-del-${index}` });
        });
      }
      if (compareResult.videosDiff) {
        compareResult.videosDiff.added.forEach((video, index) => {
          allChanges.push({ type: 'ADDED', content: `Видео добавлено: ${video}`, key: `video-add-${index}` });
        });
        compareResult.videosDiff.removed.forEach((video, index) => {
          allChanges.push({ type: 'REMOVED', content: `Видео удалено: ${video}`, key: `video-del-${index}` });
        });
      }
    }
    console.log("Все изменения для отображения (allChanges):", allChanges);
    let versionInfo = `Результаты сравнения (Версия ${compareResult.fromVersion}`;
    if (compareResult.toVersion !== undefined) {
      versionInfo += ` → Текущая версия`;
    } else {
      versionInfo += ` → Текущая версия`;
    }
    versionInfo += ")";

    return (
      <div className="comparison-result">
        <h4>{versionInfo}</h4>
        <div className="diff-container" style={{ height: '300px' }}>
          {allChanges.length > 0 ? (
            allChanges.map((change) => (
              <div key={change.key} className={`diff-line ${change.type ? change.type.toLowerCase() : 'unchanged'}`}>
                <span className="diff-indicator">
                  {change.type === 'ADDED' ? '+' : change.type === 'REMOVED' ? '-' : ' '}
                </span>
                <span className="diff-content" dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(change.content || '')
                }} />
              </div>
            ))
          ) : (
            <div className="diff-line unchanged">
              <span className="diff-indicator"> </span>
              <span className="diff-content">Нет текстовых изменений в описании</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="article-page">
        <div className="article-container">
          <div className="error-state">
            <h2>❌ Ошибка</h2>
            <p>{error}</p>
            <button onClick={() => navigate(-1)} className="btn btn-secondary">Назад</button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedArticle) {
    return (
      <div className="article-page">
        <div className="article-container">
          <div className="loading">Загрузка статьи...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="article-page">
      <div className="article-container">
        {/* Заголовок статьи */}
        <div className="article-header" ref={parallaxRef}>
          <h1 className="article-title">
            {isViewingVersion && selectedVersion
              ? `[Версия ${selectedVersion.version}] ${selectedVersion.title}`
              : selectedArticle.title}
          </h1>
          {selectedArticle.category && !isViewingVersion && (
            <span className="article-category pulse">
              {selectedArticle.category.description}
            </span>
          )}
          {isViewingVersion && selectedVersion && (
            <span className="article-category pulse" style={{ backgroundColor: '#6c757d' }}>
              Просмотр версии {selectedVersion.version}
            </span>
          )}
        </div>

        {/* Видео */}
        {videoUrl && !isViewingVersion && (
          <div className="article-section video-section">
            <div className="section-title">
              <span className="icon">🎥</span> Видеоматериал
            </div>
            <div className="video-wrapper">
              <video
                controls
                className="video-player"
                src={videoUrl}
                preload="metadata"
              >
                Ваш браузер не поддерживает видео.
              </video>
            </div>
          </div>
        )}

        {/* Описание */}
        <div className="article-section">
          <div className="title-div">
            <h2 className="section-title">
              <span className="icon">📝</span>
              {isViewingVersion && selectedVersion
                ? `Содержимое версии ${selectedVersion.version}`
                : 'Описание'}
            </h2>
            <div className="article-actions-right">
              {/* УЛУЧШЕННЫЕ Выбор версии для просмотра */}
              {(hasRole('ADMIN') || hasRole('WRITER')) && articleVersions.length > 0 && (
                <div className="version-selector-container">
                  <button
                    ref={versionButtonRef} // Привязываем ref к кнопке
                    className="btn btn-version-dropdown glow-hover"
                    onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                    aria-haspopup="true"
                    aria-expanded={showVersionDropdown}
                  >
                    📋 Версии
                  </button>
                </div>
              )}

              <button
                className="btn btn-white glow-hover"
                onClick={handleDownloadPdf}
                disabled={isPdfLoading || isViewingVersion}
              >
                {isPdfLoading ? 'Скачивание...' : 'Скачать PDF'}
              </button>
            </div>
          </div>
          <div className="content-wrapper">
            {renderDescription(selectedArticle.description)}



          </div>
        </div>

        {/* Файлы */}
        {selectedArticle.filePath && selectedArticle.filePath.length > 0 && !isViewingVersion && (
          <div className="article-section">
            <h2 className="section-title">
              <span className="icon">📎</span> Файлы
            </h2>
            <ul className="files-list">
              {selectedArticle.filePath.map((path, index) => {
                const fileName = path.split('/').pop();
                return (
                  <li key={index} className="file-item">
                    <a
                      href={`${ApiClient.defaults.baseURL}${path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-link"
                      onClick={() => {
                        logAction('INFO', 'FILE_OPENED', 'Открытие прикреплённого файла', {
                          articleId: id,
                          articleTitle: selectedArticle.title,
                          fileName,
                          filePath: path,
                          userEmail,
                        });
                      }}
                    >
                      <span className="file-icon">📄</span>
                      {fileName}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Действия */}
        <div className="article-actions">
          {!isViewingVersion && (hasRole('ADMIN') || (hasRole('WRITER') && canEditArticle)) && (
            <>
              <button
                className="btn btn-primary glow-hover"
                onClick={() => navigate(`/article/${id}/edit`)}
              >
                ✏️ Редактировать
              </button>
              <button
                className={`btn ${selectedArticle.isDelete ? 'btn-success' : 'btn-cancel'} glow-hover`}
                onClick={handleDeleteRestore}
              >
                {selectedArticle.isDelete ? '♻️ Восстановить' : 'Отключить'}
              </button>
            </>
          )}
          {!isViewingVersion && isOwnerOrAdmin && (
            <button
              className="btn btn-danger glow-hover"
              onClick={handleHardDelete}
              title="Полное удаление статьи (нельзя восстановить)"
            >
              🗑️ Удалить навсегда
            </button>
          )}
          {!isViewingVersion && isAuthenticated && (
            <button
              className="btn btn-secondary glow-hover"
              onClick={() => setIsFeedbackOpen(true)}
            >
              💬 Обратная связь
            </button>
          )}
        </div>
      </div>

      {/* Портал для дропдауна версий */}
      {showVersionDropdown && createPortal(
        <div
          id="version-dropdown-menu-portal"
          className="version-dropdown-menu"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top + 50}px`, // Смещение под кнопку
            left: `65%`,
            width: `16.5rem`, // Используем ширину кнопки
            zIndex: 10000, // Очень высокий z-index
          }}
        >
          <div className="version-list-title">Все версии</div>
          <ul className="version-list">
            {articleVersions.map(version => {
              let dateStr = 'N/A';
              if (version.editedAt) {
                try {
                  const dateObj = new Date(version.editedAt);
                  if (!isNaN(dateObj)) {
                    dateStr = dateObj.toLocaleDateString('ru-RU');
                  }
                } catch (e) {
                  console.error("Ошибка форматирования даты:", e);
                }
              }
              return (
                <li key={`version-${version.version}`} className="version-item">
                  <div className="version-info" onClick={() => handleViewVersion(version.version)}>
                    <span className="version-number">Версия {version.version}</span>
                    <span className="version-date">{dateStr}</span>
                  </div>

                  {isOwnerOrAdmin && (
                    <button
                      className="btn btn-danger version-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(version.version);
                      }}
                      title="Удалить версию"
                    >
                      🗑️
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

        </div>,
        document.body // Рендерим в body
      )}

      {/* Модальное окно: обратная связь */}
      {isFeedbackOpen && (
        <div className="modal-overlay" onClick={() => setIsFeedbackOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💬 Написать отзыв</h2>
              <button
                className="modal-close"
                onClick={() => {
                  logAction('INFO', 'FEEDBACK_CANCEL', 'Отмена отправки отзыва', {
                    articleId: id,
                    articleTitle: selectedArticle.title,
                    userEmail,
                  });
                  setIsFeedbackOpen(false);
                }}
                aria-label="Закрыть модальное окно"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="feedback-form">
              <div className="form-group">
                <label className="form-label">Заголовок отзыва</label>
                <input
                  type="text"
                  value={feedback.title}
                  onChange={e => setFeedback({ ...feedback, title: e.target.value })}
                  required
                  className="form-input"
                  placeholder="Например: Отличная статья!"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ваше мнение</label>
                <textarea
                  value={feedback.description}
                  onChange={e => setFeedback({ ...feedback, description: e.target.value })}
                  required
                  rows="4"
                  className="form-textarea"
                  placeholder="Что вам понравилось? Что можно улучшить?"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsFeedbackOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  Отправить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно сравнения версий (теперь стилизовано и правильно отображается) */}
      {showComparison && compareResult && (
        <div className="modal-overlay" onClick={() => setShowComparison(false)}>
          <div className="comparison-modal-styled" onClick={e => e.stopPropagation()}>
            <div className="comparison-modal-header-styled">
              <h3>Сравнение версий (Версия {compareResult.fromVersion} vs Текущая)</h3>
              <button
                className="comparison-modal-close-styled"
                onClick={() => setShowComparison(false)}
                title="Закрыть окно сравнения"
              >
                ×
              </button>
            </div>
            <div className="comparison-modal-content-styled">
              {renderComparison(compareResult)}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: подтверждение удаления */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

export default ArticlePage;