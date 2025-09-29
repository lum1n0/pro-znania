// src/pages/EditArticlePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { writerPermissionsAPI, categoryAPI } from '../api/apiServese'; // Добавлены импорты API
import * as Yup from 'yup';
import CustomRichEditor from '../component/CustomRichEditor';
import { logAction } from '../api/logClient';
import '../style/CreateArticlePage.css';
import right from "../assets/right.svg"
import down from "../assets/down.svg"



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

// Вспомогательный компонент для отображения дерева категорий
// Вставьте этот компонент вместо старого CategorySelectorTree
const CategorySelectorTree = ({ categories, selectedCategoryId, onSelect }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Функция для построения дерева категорий
  const buildTree = (categoriesList) => {
    const map = {};
    const roots = [];
    categoriesList.forEach(cat => {
      map[cat.id] = { ...cat, children: [] };
    });
    categoriesList.forEach(cat => {
      const node = map[cat.id];
      if (cat.parentId) {
        const parent = map[cat.parentId];
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const tree = buildTree(categories);

  // Рекурсивный компонент для отображения узла дерева
  const TreeNode = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedCategoryId === String(node.id);
    const isExpanded = expandedNodes.has(node.id);
    const paddingLeft = `${level * 20 + 10}px`;

    const toggleExpand = () => {
      const newExpanded = new Set(expandedNodes);
      if (isExpanded) {
        newExpanded.delete(node.id);
      } else {
        newExpanded.add(node.id);
      }
      setExpandedNodes(newExpanded);
    };

    return (
      <div className="category-tree-node">
        <div
          className={`category-item-selector ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(String(node.id))}
          style={{ paddingLeft }}
        >
          <span className="category-item-icon" onClick={toggleExpand} style={{ cursor: 'pointer' }}>
            {hasChildren ? (
              isExpanded ? 
                <img src={down} alt="Свернуть" style={{ width: 16, height: 16 }} /> : 
                <img src={right} alt="Развернуть" style={{ width: 16, height: 16 }} />
            ) : (
              '📁'
            )}
          </span>
          <span className="category-item-name">{node.description}</span>
        </div>

        {hasChildren && (
          <div className={`category-children ${isExpanded ? 'expanded' : 'collapsed'}`}>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="category-tree">
      {tree.map(rootNode => (
        <TreeNode key={rootNode.id} node={rootNode} />
      ))}
    </div>
  );
};

const EditArticlePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { updateArticle, fetchArticleById } = useArticleStore();

  // НОВОЕ: нужен user для проверки роли
  const { user, userId, userEmail: storeUserEmail, isAuthenticated, checkAuth } = useAuthStore();

  const [formData, setFormData] = useState({ title: '', description: '', categoryId: '' });
  const [files, setFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [existingVideo, setExistingVideo] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]); // Добавлено
  const [isLoadingCategories, setIsLoadingCategories] = useState(false); // Добавлено

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
    checkAuth();
    if (!isAuthenticated) {
      const fallbackEmail = 'guest';
      logAction('WARN', 'AUTH_REQUIRED', 'Доступ запрещён: пользователь не авторизован', {
        articleId: id,
        redirect: '/login',
        userEmail: fallbackEmail,
      });
      navigate('/login');
    }
  }, [checkAuth, isAuthenticated, id, navigate]);

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user]); // Зависимость от user, а не от isAuthenticated

  useEffect(() => {
    if (!id || !isAuthenticated || isLoadingCategories) return;

    const loadArticle = async () => {
      setLoading(true);
      try {
        const article = await fetchArticleById(id);
        if (!article) throw new Error('Статья не найдена');

        const descriptionHTML = deltaToHtml(article.description);

        const categoryId = article.categoryId || (article.categoryDto?.id ? Number(article.categoryDto.id) : '');

        setFormData({
          title: article.title || '',
          description: descriptionHTML,
          categoryId: categoryId ? String(categoryId) : '', // Преобразуем в строку для согласования с CategorySelectorTree
        });
        setExistingVideo(article.videoPath?.[0] || null);
        setExistingFiles(article.filePath || []);

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
  }, [id, fetchArticleById, isAuthenticated, isLoadingCategories]);

  // --- Drag & Drop для документов ---
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

  // --- Drag & Drop для видео ---
  const handleVideoDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
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
      const articleFormData = new FormData();
      articleFormData.append('title', formData.title);
      const descriptionDelta = JSON.stringify(htmlToDelta(formData.description));
      articleFormData.append('description', descriptionDelta);
      articleFormData.append('categoryId', formData.categoryId); // categoryId уже строка

      if (videoFile) articleFormData.append('videoFile', videoFile);
      files.forEach(file => articleFormData.append('files', file));

      const result = await updateArticle(id, articleFormData);

      if (result) {
        logAction('INFO', 'ARTICLE_UPDATE_SUCCESS', 'Статья успешно обновлена', {
          articleId: id,
          articleTitle: result.title,
          userId,
          userEmail: storeUserEmail || 'guest',
        });
        navigate(`/article/${result.id}`);
      } else {
        setErrors({ general: 'Не удалось получить обновлённую статью' });
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
              <CategorySelectorTree
                categories={availableCategories}
                selectedCategoryId={formData.categoryId}
                onSelect={(categoryId) => setFormData(prev => ({ ...prev, categoryId }))}
              />
              {errors.categoryId && <p className="error">{errors.categoryId}</p>}
            </div>
          )}
        </div>
        {/* === Конец обновленного блока === */}

        {/* Dropzone для видео */}
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