// src/pages/CreateArticlePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { useArticleStore } from '../store/articleStore'; // не нужен, логика уходит на apiClient
import { useAuthStore } from '../store/authStore';
import { writerPermissionsAPI, categoryAPI } from '../api/apiServese';
import { ApiClient as apiClient } from '../api/apiClient';
import CustomRichEditor from '../component/CustomRichEditor';
import { showSuccess, showError } from '../utils/toastUtils';
import * as Yup from 'yup';
import { logAction } from '../api/logClient';
import '../style/CreateArticlePage.css';
import CategorySelectorTree from '../component/CategorySelectorTree';

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

const CreateArticlePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // categoryId из URL-параметров
  const urlParams = new URLSearchParams(location.search);
  const initialCategoryId = urlParams.get('categoryId');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: initialCategoryId || '',
  });

  const [files, setFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);

  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);

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

  // Подхват пресета из навигации или sessionStorage
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
      setFormData((prev) => ({
        ...prev,
        title: preset.title ?? prev.title,
        description: preset.description ?? prev.description,
        categoryId: preset.categoryId ?? prev.categoryId ?? initialCategoryId ?? '',
      }));
      try { sessionStorage.removeItem('editorPreset'); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Загрузка категорий по роли
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
    if (user) {
      loadCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Сабмит с разделением по ролям
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    try {
      await validationSchema.validate(formData, { abortEarly: false });

      const fd = new FormData();
      fd.append('title', formData.title);
      const descriptionDelta = JSON.stringify(htmlToDelta(formData.description));
      fd.append('description', descriptionDelta);
      fd.append('categoryId', formData.categoryId);
      files.forEach(file => fd.append('files', file));
      if (videoFile) fd.append('videoFile', videoFile);

      setIsUploading(true);

      if (isWriter(user)) {
        // WRITER — заявка на модерацию
        await apiClient.post('/api/moderation/submit/create', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logAction('INFO', 'PROPOSAL_CREATE', 'Заявка отправлена на модерацию', {
          title: formData.title,
          categoryId: formData.categoryId,
          fileCount: files.length,
          hasVideo: !!videoFile,
        });
        showSuccess('Заявка отправлена на модерацию');
        navigate('/my/requests');
      } else if (isAdmin(user) || isModerator(user)) {
        // MODERATOR/ADMIN — прямая публикация
        const { data } = await apiClient.post('/api/articles', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logAction('INFO', 'ARTICLE_CREATE', 'Статья опубликована', {
          articleId: data?.id,
          title: data?.title,
          categoryId: formData.categoryId,
          fileCount: files.length,
          hasVideo: !!videoFile,
        });
        showSuccess('Статья опубликована');
        if (data?.id) navigate(`/article/${data.id}`);
      } else {
        showError('Недостаточно прав');
      }
    } catch (validationError) {
      if (validationError.inner) {
        const newErrors = {};
        validationError.inner.forEach((err) => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } else {
        console.error('Ошибка при отправке:', validationError);
        setErrors({ general: 'Ошибка при создании статьи' });
        logAction('ERROR', 'ARTICLE_CREATE_FAIL', 'Ошибка при создании статьи', {
          title: formData.title,
          categoryId: formData.categoryId,
          error: validationError.message,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDescriptionChange = (value) => {
    setFormData((prev) => ({ ...prev, description: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // DnD документы
  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };
  const handleFileInputChange = (e) => {
    const newFiles = Array.from(e.dataTransfer ? e.dataTransfer.files : e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
  };
  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // DnD видео
  const handleVideoDrop = (e) => {
    e.preventDefault();
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

  return (
    <div className="create-article-container">
      <div className="page-header">
        <h2>Создать статью</h2>
      </div>

      <form onSubmit={handleSubmit} className="article-form" noValidate>
        <div className="form-group">
          <label htmlFor="title" className="form-label">Заголовок</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={`form-input ${errors.title ? 'error-input' : ''}`}
            disabled={isLoadingCategories || isUploading}
          />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Описание</label>
          <CustomRichEditor
            value={formData.description}
            onChange={handleDescriptionChange}
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
                disabled={isLoadingCategories || isUploading}
              />
              {errors.categoryId && <p className="error">{errors.categoryId}</p>}
            </div>
          )}
        </div>

        {/* Видео */}
        <div className="form-group">
          <label className="form-label">Видеофайл (необязательно)</label>
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
            <input type="file" accept="video/*" onChange={handleVideoInputChange} className="dropzone-input" disabled={isUploading} />
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
          <label className="form-label">Файлы-документы (необязательно)</label>
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
            <input type="file" multiple onChange={handleFileInputChange} className="dropzone-input" disabled={isUploading} />
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
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary" disabled={isUploading}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isUploading || isLoadingCategories || availableCategories.length === 0}
          >
            {isUploading ? 'Загрузка...' : 'Создать статью'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateArticlePage;
