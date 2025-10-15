// src/pages/EditArticlePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { writerPermissionsAPI, categoryAPI } from '../api/apiServese';
import { showSuccess, showError } from '../utils/toastUtils';
import { ApiClient as apiClient } from '../api/apiClient';
import * as Yup from 'yup';
import CustomRichEditor from '../component/CustomRichEditor';
import { logAction } from '../api/logClient';
import '../style/CreateArticlePage.css';
import right from "../assets/right.svg";
import CategorySelectorTree from '../component/CategorySelectorTree';
import down from "../assets/down.svg";

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

const htmlToDelta = (html) => {
  return { ops: [{ insert: html }] };
};


const EditArticlePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { fetchArticleById } = useArticleStore();
  const { user, userId, userEmail: storeUserEmail, isAuthenticated, checkAuth } = useAuthStore();

  const [formData, setFormData] = useState({ title: '', description: '', categoryId: '' });
  const [files, setFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [existingVideo, setExistingVideo] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Флаг, что пресет применён и контент статьи не должен быть перезатёрт загрузкой
  const presetAppliedRef = useRef(false);

  const validationSchema = Yup.object({
    title: Yup.string().required('Заголовок обязателен'),
    description: Yup.string()
      .required('Описание обязательно')
      .test('has-content', 'Описание не должно быть пустым', (value) => {
        if (!value) return false;
        const plainText = value.replace(/<[^>]*>/g, '').trim();
        return plainText.length > 0;
      }),
    categoryId: Yup.string().required('Выберите категорию'),
  });

  // Роли
  const isWriter = (u) => u?.roles?.includes('ROLE_WRITER') || u?.roles?.includes('WRITER');
  const isAdmin = (u) => u?.roles?.includes('ROLE_ADMIN') || u?.roles?.includes('ADMIN');
  const isModerator = (u) => u?.roles?.includes('ROLE_MODERATOR') || u?.roles?.includes('MODERATOR');

  // Подхват пресета из навигации или sessionStorage (до загрузки статьи)
  useEffect(() => {
    let preset = location.state?.preset;
    if (!preset) {
      try {
        const raw = sessionStorage.getItem('editorPreset');
        if (raw) preset = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (preset) {
      setFormData(prev => ({
        ...prev,
        title: preset.title ?? prev.title,
        description: preset.description ?? prev.description,
        categoryId: preset.categoryId ?? prev.categoryId,
      }));
      presetAppliedRef.current = true;
      try { sessionStorage.removeItem('editorPreset'); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Категории по роли
  const loadCategories = async () => {
    setIsLoadingCategories(true);
    setAvailableCategories([]);
    try {
      if (isWriter(user)) {
        const response = await writerPermissionsAPI.getEditableCategories();
        const categories = Array.isArray(response.data) ? response.data : [];
        setAvailableCategories(categories);
      } else if (isAdmin(user) || isModerator(user)) {
        const response = await categoryAPI.getAllCategories(0, 1000);
        const categories = response.data.content || response.data || [];
        setAvailableCategories(categories);
      } else {
        const response = await categoryAPI.getCategoriesForUser(user.id, 0, 100);
        const categories = response.data.content || response.data || [];
        setAvailableCategories(categories);
      }
    } catch (error) {
      console.error('Ошибка при загрузке категорий:', error);
      setErrors({ general: 'Не удалось загрузить категории' });
      logAction('ERROR', 'CATEGORY_LOAD_FAIL', 'Ошибка при загрузке категорий', {
        userId: user?.id,
        userRoles: user?.roles,
        error: error.message,
      });
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    checkAuth();
    if (!isAuthenticated) {
      logAction('WARN', 'AUTH_REQUIRED', 'Доступ запрещён: пользователь не авторизован', {
        articleId: id,
        redirect: '/login',
        userEmail: 'guest',
      });
      navigate('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAuth, isAuthenticated, id, navigate]);

  useEffect(() => {
    if (user) {
      loadCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!id || !isAuthenticated || isLoadingCategories) return;

    const loadArticle = async () => {
      setLoading(true);
      try {
        const article = await fetchArticleById(id);
        if (!article) throw new Error('Статья не найдена');

        const descriptionHTML = deltaToHtml(article.description);
        const categoryId = article.categoryId || (article.categoryDto?.id ? Number(article.categoryDto.id) : '');

        // Метаданные текущего состояния статьи — сохраняем всегда
        setExistingVideo(article.videoPath?.[0] || null);
        setExistingFiles(article.filePath || []);

        // Если пресет уже применён — не перезаписываем title/description/categoryId
        if (!presetAppliedRef.current) {
          setFormData({
            title: article.title || '',
            description: descriptionHTML,
            categoryId: categoryId ? String(categoryId) : '',
          });
        }

        logAction('INFO', 'ARTICLE_LOADED', 'Статья загружена', {
          articleId: id,
          articleTitle: article.title,
          userEmail: storeUserEmail || 'guest',
        });
      } catch (error) {
        logAction('ERROR', 'ARTICLE_LOAD_FAIL', 'Ошибка загрузки статьи', {
          articleId: id,
          articleTitle: formData.title,
          error: error.message,
          userEmail: storeUserEmail || 'guest',
        });
        setErrors({ general: 'Не удалось загрузить статью' });
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchArticleById, isAuthenticated, isLoadingCategories]);

  // DnD документы
  const handleFileDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };
  const handleFileInputChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
  };
  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // DnD видео
  const handleVideoDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) setVideoFile(droppedFile);
  };
  const handleVideoInputChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) setVideoFile(file);
  };
  const removeVideo = () => setVideoFile(null);

  const addDragOverClass = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };
  const removeDragOverClass = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  // Сабмит с разделением по ролям
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsUploading(true);

    try {
      await validationSchema.validate(formData, { abortEarly: false });
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        const validationErrors = {};
        error.inner.forEach((err) => {
          validationErrors[err.path] = err.message;
        });
        setErrors(validationErrors);
      }
      setIsUploading(false);
      return;
    }

    try {
      const fd = new FormData();
      fd.append('title', formData.title);
      const descriptionDelta = JSON.stringify(htmlToDelta(formData.description));
      fd.append('description', descriptionDelta);
      fd.append('categoryId', formData.categoryId);
      if (videoFile) fd.append('videoFile', videoFile);
      files.forEach(file => fd.append('files', file));

      if (isWriter(user)) {
        // WRITER — заявка на модерацию
        await apiClient.post(`/api/moderation/submit/update/${id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logAction('INFO', 'PROPOSAL_UPDATE', 'Обновление отправлено на модерацию', {
          articleId: id,
          title: formData.title,
          categoryId: formData.categoryId,
          addFiles: files.length,
          replaceVideo: !!videoFile,
        });
        showSuccess('Обновление отправлено на модерацию');
        navigate('/my/work');
      } else if (isAdmin(user) || isModerator(user)) {
        // MODERATOR/ADMIN — обновление и публикация
        const { data } = await apiClient.put(`/api/articles/${id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logAction('INFO', 'ARTICLE_UPDATE_SUCCESS', 'Статья обновлена и опубликована', {
          articleId: id,
          articleTitle: data?.title,
          addFiles: files.length,
          replaceVideo: !!videoFile,
        });
        showSuccess('Статья обновлена и опубликована');
        navigate(`/article/${data?.id ?? id}`);
      } else {
        showError('Недостаточно прав');
      }
    } catch (error) {
      logAction('ERROR', 'ARTICLE_UPDATE_FAILED', 'Ошибка при обновлении статьи', {
        articleId: id,
        articleTitle: formData.title,
        error: error.message,
        userEmail: storeUserEmail || 'guest',
      });
      console.error('Ошибка обновления статьи:', error);
      setErrors({ general: 'Ошибка обновления статьи' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    logAction('INFO', 'EDIT_CANCELLED', 'Редактирование статьи отменено', {
      articleId: id,
      articleTitle: formData.title,
      unsavedChanges: true,
      userEmail: storeUserEmail || 'guest',
    });
    navigate(-1);
  };

  if (!isAuthenticated) return null;
  if (loading || isLoadingCategories) return <div className="create-article-container loading">Загрузка...</div>;

  return (
    <div className="create-article-container">
      <div className="page-header">
        <h2>Редактировать статью</h2>
      </div>

      <form onSubmit={handleSubmit} className="article-form">
        <div className="form-group">
          <label className="form-label">Заголовок</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={`form-input ${errors.title ? 'error-input' : ''}`}
            disabled={isLoadingCategories || isUploading}
          />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Описание</label>
          <CustomRichEditor
            key={id}
            value={formData.description || ''}
            onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
            placeholder="Введите описание статьи..."
            disabled={isLoadingCategories || isUploading}
          />
          {errors.description && <div className="error">{errors.description}</div>}
        </div>

        {/* Категория */}
        <div className="form-group">
          <label className="form-label">Категория</label>
          {isLoadingCategories ? (
            <div className="loading-categories">Загрузка категорий...</div>
          ) : availableCategories.length === 0 ? (
            <div className="category-selector">
              <p className="info-message">
                {isWriter(user) ? 'У вас нет доступных категорий для создания статей' : 'Нет доступных категорий'}
              </p>
            </div>
          ) : (
            <div className="category-selector">
              <CategorySelectorTree
                categories={availableCategories}
                selectedCategoryId={formData.categoryId}
                onSelect={(categoryId) => setFormData(prev => ({ ...prev, categoryId }))}
              />
              {errors.categoryId && <p className="error">{errors.categoryId}</p>}
            </div>
          )}
        </div>

        {/* Видео */}
        <div className="form-group">
          <label className="form-label">Текущий видеофайл:</label>
          {existingVideo ? (
            <p className="current-file">📹 {existingVideo.split('/').pop()}</p>
          ) : (
            <p className="no-file">Видео не загружено</p>
          )}

          <label className="form-label">Заменить видеофайл:</label>
          <div
            onDragOver={addDragOverClass}
            onDragEnter={addDragOverClass}
            onDragLeave={removeDragOverClass}
            onDrop={handleVideoDrop}
            className="dropzone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>Перетащите видео или кликните, чтобы выбрать</p>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoInputChange}
              className="dropzone-input"
              disabled={isUploading}
            />
          </div>

          {videoFile && (
            <div className="video-preview">
              <h4 className="preview-title">Выбранное видео:</h4>
              <ul className="files-list">
                <li className="file-item">
                  <span className="file-icon">🎥</span>
                  <span className="file-name">{videoFile.name}</span>
                  <button type="button" onClick={removeVideo} className="remove-file-btn" disabled={isUploading}>×</button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Файлы */}
        <div className="form-group">
          <label className="form-label">Текущие файлы:</label>
          {existingFiles.length > 0 ? (
            <ul className="current-files-list">
              {existingFiles.map((file, index) => (
                <li key={index} className="file-item">
                  📄 {file.split('/').pop()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-file">Файлы не загружены</p>
          )}

          <label className="form-label">Добавить новые файлы:</label>
          <div
            onDragOver={addDragOverClass}
            onDragEnter={addDragOverClass}
            onDragLeave={removeDragOverClass}
            onDrop={handleFileDrop}
            className="dropzone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 10h-1m-5-7v7m0 0v7m0-7h7m-7 0H9" />
            </svg>
            <p>Перетащите файлы сюда или кликните, чтобы выбрать</p>
            <input
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="dropzone-input"
              disabled={isUploading}
            />
          </div>

          {files.length > 0 && (
            <div className="files-preview">
              <h4 className="preview-title">Выбранные файлы:</h4>
              <ul className="files-list">
                {files.map((file, index) => (
                  <li key={index} className="file-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.name}</span>
                    <button type="button" onClick={() => removeFile(index)} className="remove-file-btn" disabled={isUploading}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {errors.general && <p className="error general-error">{errors.general}</p>}

        <div className="form-actions">
          <button type="button" onClick={handleCancel} className="btn btn-secondary" disabled={isUploading}>
            Вернуться назад
          </button>
          <button type="submit" className="btn btn-primary" disabled={isUploading || isLoadingCategories}>
            {isUploading ? 'Загрузка...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditArticlePage;
