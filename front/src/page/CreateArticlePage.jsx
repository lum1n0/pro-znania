// src/pages/CreateArticlePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { writerPermissionsAPI, categoryAPI } from '../api/apiServese';
import CustomRichEditor from '../component/CustomRichEditor';
import * as Yup from 'yup';
import { logAction } from '../api/logClient';
import '../style/CreateArticlePage.css';
import CategorySelectorTree from '../component/CategorySelectorTree'; // Импорт нового компонента

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
  const { createArticle } = useArticleStore();
  const { user } = useAuthStore();
  // Получаем categoryId из URL-параметров
  const urlParams = new URLSearchParams(location.search);
  const initialCategoryId = urlParams.get('categoryId');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: initialCategoryId || '', // Инициализируем categoryId из URL
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
  // Функция для проверки роли пользователя
  const isWriter = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.includes('ROLE_WRITER') || user.roles.includes('WRITER');
  };
  const isAdmin = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.includes('ADMIN') || user.roles.includes('ROLE_ADMIN');
  };
  // Функция для загрузки категорий в зависимости от роли пользователя
  const loadCategories = async () => {
    setIsLoadingCategories(true);
    setAvailableCategories([]);
    try {
      console.log('Текущий пользователь:', user);
      console.log('Роли пользователя:', user?.roles);
      console.log('Пользователь WRITER:', isWriter(user));
      console.log('Пользователь ADMIN:', isAdmin(user));
      if (isWriter(user)) {
        // Для писателя загружаем только доступные категории через новый эндпоинт
        console.log('Загрузка доступных категорий для WRITER через /api/writer-permissions/me/categories-editable');
        const response = await writerPermissionsAPI.getEditableCategories();
        console.log('Ответ от API для WRITER:', response);
        console.log('Данные категорий для WRITER:', response.data);
        const categories = Array.isArray(response.data) ? response.data : [];
        console.log('Финальные категории для WRITER:', categories);
        setAvailableCategories(categories);
      } else if (isAdmin(user)) {
        // Для администратора загружаем все категории
        console.log('Загрузка всех категорий для ADMIN');
        const response = await categoryAPI.getAllCategories(0, 1000);
        console.log('Ответ от API для ADMIN:', response);
        const categories = response.data.content || response.data || [];
        console.log('Финальные категории для ADMIN:', categories);
        setAvailableCategories(categories);
      } else {
        // Для других ролей загружаем категории по пользователю
        console.log('Загрузка категорий для обычного пользователя');
        const response = await categoryAPI.getCategoriesForUser(user.id, 0, 100);
        const categories = response.data.content || response.data || [];
        console.log('Финальные категории для USER:', categories);
        setAvailableCategories(categories);
      }
    } catch (error) {
      console.error('Ошибка при загрузке категорий:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
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
  }, [user]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      await validationSchema.validate(formData, { abortEarly: false });
      const articleFormData = new FormData();
      articleFormData.append('title', formData.title);
      const descriptionDelta = JSON.stringify(htmlToDelta(formData.description));
      articleFormData.append('description', descriptionDelta);
      articleFormData.append('categoryId', formData.categoryId);
      files.forEach(file => articleFormData.append('files', file));
      if (videoFile) {
        articleFormData.append('videoFile', videoFile);
      }
      setIsUploading(true);
      const article = await createArticle(articleFormData);
      if (article) {
        logAction('INFO', 'ARTICLE_CREATE', 'Статья успешно создана', {
          articleId: article.id,
          title: article.title,
          categoryId: formData.categoryId,
          fileCount: files.length,
          hasVideo: !!videoFile,
        });
        navigate(`/article/${article.id}`);
      }
    } catch (validationError) {
      setIsUploading(false);
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
    }
  };
  const handleDescriptionChange = (value) => {
    setFormData((prev) => ({ ...prev, description: value }));
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  // --- Drag & Drop для документов ---
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
  // --- Drag & Drop для видео ---
  const handleVideoDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setVideoFile(droppedFile);
    }
  };
  const handleVideoInputChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };
  const removeVideo = () => {
    setVideoFile(null);
  };
  const preventDefault = (e) => {
    e.preventDefault();
  };
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
        {/* === Обновленный блок выбора категории === */}
        <div className="form-group">
          <label className="form-label">Категория</label>
          {isLoadingCategories ? (
            <div className="loading-categories">Загрузка категорий...</div>
          ) : availableCategories.length === 0 ? (
            <div className="category-selector">
              <p className="info-message">
                {isWriter(user)
                  ? 'У вас нет доступных категорий для создания статей'
                  : 'Нет доступных категорий'}
              </p>
            </div>
          ) : (
            <div className="category-selector">
              {/* Используем импортированный компонент */}
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
        {/* === Конец обновленного блока === */}
        {/* Dropzone для видео */}
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
          {/* Превью видео — отображается ПОСЛЕ dropzone */}
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
        {/* Dropzone для файлов */}
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
          {/* Превью файлов — отображается ПОСЛЕ dropzone */}
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