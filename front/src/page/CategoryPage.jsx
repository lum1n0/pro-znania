// src/pages/CategoryPage.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { useAccessRoleStore } from '../store/accessRoleStore';
import ArticleCard from '../component/ArticleCard';
import CategorySelectorTree from '../component/CategorySelectorTree'; // Импорт нового компонента
import '../style/CategoryPage.css';
import { Folder, Plus, Edit, Trash2, EyeOff } from 'lucide-react';
import { showSuccess, showError, showWarning } from '../utils/toastUtils';
import ConfirmationModal from '../component/ConfirmationModal';
import { writerPermissionsAPI } from '../api/apiServese'; // Импортируем API

const CategoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const categoryId = useMemo(() => Number(id), [id]);
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    fetchGuestCategories,
    isLoading: categoriesLoading,
    childCategories,
    fetchChildCategories,
    fetchCategories,
    createCategory,
    updateCategory,
    softDeleteCategory,
  } = useCategoryStore();
  const {
    articles,
    articlesByCategory,
    fetchArticlesByCategory,
    fetchGuestArticlesByCategory,
    isLoading: articlesLoading
  } = useArticleStore();
  const { accessRoles, fetchAllAccessRoles } = useAccessRoleStore();
  const { isAuthenticated, hasRole, userId } = useAuthStore();

  // 🔍 Локальный поиск
  const [searchQuery, setSearchQuery] = useState('');
  const [localLoading, setLocalLoading] = useState(true);
  // Состояния для выпадающих меню
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRefs = useRef({});
  // Состояния для модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);
  // Состояния для форм
  const [newCategory, setNewCategory] = useState({
    description: '',
    iconPath: '',
    accessRoles: [],
    parentId: null,
  });
  const [editCategory, setEditCategory] = useState({
    id: null,
    description: '',
    iconPath: '',
    accessRoles: [],
    parentId: null,
  });
  // Состояние для модального окна подтверждения
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // === Состояния для проверки прав WRITER ===
  const [canWriterEdit, setCanWriterEdit] = useState(null); // null - не проверяли/не нужно, true/false - результат
  const [isWriterPermissionLoading, setIsWriterPermissionLoading] = useState(false);
  const [writerPermissionError, setWriterPermissionError] = useState(null);

  // === Функция для проверки прав WRITER ===
  const checkWriterPermission = async (catId) => {
    // Проверяем, нужно ли вообще выполнять проверку
    if (
      !isAuthenticated ||
      !hasRole('WRITER') ||
      catId === null ||
      catId === undefined ||
      isNaN(catId)
    ) {
      // Если проверка не требуется, сбрасываем состояние
      if (canWriterEdit !== null) setCanWriterEdit(null);
      return;
    }

    setIsWriterPermissionLoading(true);
    setWriterPermissionError(null);
    try {
      // Вызов API для проверки прав
      const response = await writerPermissionsAPI.canEditArticle(catId);
      // Предполагаем, что API возвращает { data: true } или { data: false }
      const isAllowed = response?.data === true;
      setCanWriterEdit(isAllowed);
    } catch (err) {
      console.error(`Ошибка проверки прав WRITER для категории ${catId}:`, err);
      setWriterPermissionError('Не удалось проверить права доступа.');
      setCanWriterEdit(false); // Считаем, что доступа нет в случае ошибки
    } finally {
      setIsWriterPermissionLoading(false);
    }
  };

  // === Эффект для запуска проверки прав при изменении categoryId или роли пользователя ===
  useEffect(() => {
    checkWriterPermission(categoryId);
  }, [categoryId, isAuthenticated, hasRole]); // Зависимости: categoryId, isAuthenticated, hasRole

  // Загрузка ролей доступа
  useEffect(() => {
    fetchAllAccessRoles();
  }, [fetchAllAccessRoles]);

  // Загрузка категорий
  useEffect(() => {
    let isMounted = true;
    const loadCategoryData = async () => {
      setLocalLoading(true);
      try {
        if (isAuthenticated) {
          await fetchCategories();
        } else {
          await fetchGuestCategories();
        }
      } catch (error) {
        console.error('Ошибка загрузки данных категории:', error);
      } finally {
        if (isMounted) {
          setLocalLoading(false);
        }
      }
    };
    if (!isNaN(categoryId)) {
      loadCategoryData();
    } else {
      setLocalLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [categoryId, isAuthenticated, fetchCategories, fetchGuestCategories]);

  // Отдельный эффект для установки выбранной категории
  useEffect(() => {
    if (!localLoading && categories.length > 0) {
      const foundCategory = categories.find((cat) => cat.id === categoryId);
      if (foundCategory) {
        setSelectedCategory(foundCategory);
      } else {
        console.warn(`Категория с ID ${categoryId} не найдена в загруженном списке.`);
      }
    }
  }, [categories, categoryId, localLoading, setSelectedCategory]);

  // Загрузка дочерних категорий
  useEffect(() => {
    let isMounted = true;
    const loadChildren = async () => {
      if (!isNaN(categoryId)) {
        try {
          await fetchChildCategories(categoryId);
        } catch (error) {
          console.error('Ошибка загрузки дочерних категорий:', error);
        }
      }
    };
    if (isMounted && !isNaN(categoryId)) {
      loadChildren();
    }
    return () => {
      isMounted = false;
    };
  }, [categoryId, fetchChildCategories]);

  // Загрузка статей при изменении категории или статуса авторизации
  useEffect(() => {
    let isMounted = true;
    const loadArticles = async () => {
      if (!isNaN(categoryId)) {
        try {
          if (isAuthenticated) {
            await fetchArticlesByCategory(categoryId);
          } else {
            await fetchGuestArticlesByCategory(categoryId);
          }
        } catch (error) {
          console.error('Ошибка загрузки статей:', error);
        }
      }
    };
    if (isMounted && !isNaN(categoryId)) {
      loadArticles();
    }
    return () => {
      isMounted = false;
    };
  }, [categoryId, isAuthenticated, fetchArticlesByCategory, fetchGuestArticlesByCategory]);

  // Обработчики для выпадающего меню
  const toggleDropdown = (id, event) => {
    event.stopPropagation();
    setOpenDropdownId(openDropdownId === id ? null : id);
  };
  const handleClickOutside = (event) => {
    if (openDropdownId && dropdownRefs.current[openDropdownId] && !dropdownRefs.current[openDropdownId].contains(event.target)) {
      setOpenDropdownId(null);
    }
  };
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  const getArticleWord = (count) => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'статей';
    }
    switch (lastDigit) {
      case 1:
        return 'статья';
      case 2:
      case 3:
      case 4:
        return 'статьи';
      default:
        return 'статей';
    }
  };

  // Получаем дочерние категории
  const currentChildCategories = childCategories[categoryId] || [];

  // Получаем статьи текущей категории
  const categoryArticles = isAuthenticated
    ? articles.filter(
      (article) =>
        (article.categoryDto?.id || article.categoryId) === categoryId
    )
    : articlesByCategory[categoryId] || [];

  // 🔍 Фильтрация по поисковому запросу
  const filteredArticles = searchQuery
    ? categoryArticles.filter((article) => {
      const query = searchQuery.toLowerCase();
      return (
        article.title.toLowerCase().includes(query) ||
        (article.description?.ops &&
          Array.isArray(article.description.ops) &&
          article.description.ops.some((op) =>
            typeof op.insert === 'string' ? op.insert.toLowerCase().includes(query) : false
          ))
      );
    })
    : categoryArticles;

  // Очистка поиска
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Определяем текущую категорию
  const currentCategory = selectedCategory || categories.find((cat) => cat.id === categoryId);

  // ✅ Функция для получения пути к категории (навигация)
  const getCategoryPath = (category) => {
    const path = [];
    let current = category;
    let iterations = 0;
    const maxIterations = 100;
    while (current && iterations < maxIterations) {
      path.unshift(current);
      if (current.parentId) {
        const next = categories.find(cat => cat.id === current.parentId);
        if (!next) {
          console.warn(`Родительская категория с ID ${current.parentId} не найдена.`);
          break;
        }
        current = next;
      } else {
        current = null;
      }
      iterations++;
    }
    if (iterations >= maxIterations) {
      console.error("Превышено максимальное количество итераций при построении пути категории. Возможна циклическая ссылка.");
    }
    return path;
  };

  // Получаем путь к текущей категории
  const categoryPath = currentCategory ? getCategoryPath(currentCategory) : [];

  // ✅ Обработчики навигации теперь используют navigate(-1) и navigate(1)
  const handleBack = () => {
    navigate(-1);
  };
  const handleForward = () => {
    navigate(1);
  };

  // === Функции для модальных окон ===
  const openCreateChildModal = (parentCategoryItem) => {
    setParentCategory(parentCategoryItem);
    setNewCategory({
      description: '',
      iconPath: '',
      accessRoles: [],
      parentId: parentCategoryItem.id,
    });
    setShowCreateModal(true);
  };

  const openEditForm = (category) => {
    setEditingCategory(category);
    setEditCategory({
      id: category.id,
      description: category.description,
      iconPath: category.iconPath || '',
      accessRoles: category.accessRolesDto || [],
      parentId: category.parentId || null,
    });
    setShowEditModal(true);
  };

  const handleCreateInputChange = (e) => {
    const { name, value } = e.target;
    setNewCategory({ ...newCategory, [name]: value });
  };

  const handleCreateAccessRoleChange = (roleId, roleTitle, isChecked) => {
    if (hasRole('WRITER') && roleTitle === 'FULL_ACCESS') {
      showWarning('Писатели не могут назначать роль FULL_ACCESS');
      return;
    }
    let updatedAccessRoles = [...newCategory.accessRoles];
    if (isChecked) {
      updatedAccessRoles.push({ id: roleId, title: roleTitle });
    } else {
      updatedAccessRoles = updatedAccessRoles.filter((role) => role.id !== roleId);
    }
    setNewCategory({ ...newCategory, accessRoles: updatedAccessRoles });
  };

  const isCreateAccessRoleSelected = (roleId) => {
    return newCategory.accessRoles.some((role) => role.id === roleId);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Изменение поля ${name} в форме редактирования на:`, value);
    if (name === 'parentId') {
      let parentIdValue = null;
      if (value !== '' && value !== 'null') {
        parentIdValue = parseInt(value, 10);
        if (isNaN(parentIdValue)) {
          console.warn("Некорректное значение parentId, установлено в null:", value);
          parentIdValue = null;
        }
      }
      console.log("Обработанное значение parentId:", parentIdValue);
      setEditCategory(prev => ({ ...prev, parentId: parentIdValue }));
    } else {
      setEditCategory(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditAccessRoleChange = (roleId, roleTitle, isChecked) => {
    if (hasRole('WRITER') && roleTitle === 'FULL_ACCESS') {
      showWarning('Писатели не могут назначать роль FULL_ACCESS');
      return;
    }
    let updatedAccessRoles = [...editCategory.accessRoles];
    if (isChecked) {
      updatedAccessRoles.push({ id: roleId, title: roleTitle });
    } else {
      updatedAccessRoles = updatedAccessRoles.filter((role) => role.id !== roleId);
    }
    setEditCategory({ ...editCategory, accessRoles: updatedAccessRoles });
  };

  const isEditAccessRoleSelected = (roleId) => {
    return editCategory.accessRoles.some((role) => role.id === roleId);
  };

  // === Создание категории ===
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const categoryDto = {
      description: newCategory.description,
      iconPath: newCategory.iconPath,
      accessRolesDto: newCategory.accessRoles,
      parentId: newCategory.parentId,
    };
    try {
      const success = await createCategory(categoryDto);
      if (success) {
        showSuccess(newCategory.parentId
          ? `Дочерняя категория "${newCategory.description}" создана`
          : `Категория "${newCategory.description}" создана`);
        setShowCreateModal(false);
        setParentCategory(null);
        setNewCategory({ description: '', iconPath: '', accessRoles: [], parentId: null });
        if (newCategory.parentId) {
          await fetchChildCategories(newCategory.parentId);
        } else {
          await fetchCategories();
        }
      } else {
        showError('Ошибка при создании категории');
      }
    } catch (error) {
      console.error("Ошибка при создании категории:", error);
      showError('Ошибка при создании категории: ' + (error.message || ''));
    }
  };

  // === Редактирование категории ===
  const handleEditCategory = async (e) => {
    e.preventDefault();
    console.log("Данные editCategory перед отправкой:", editCategory);
    const updateCategoryDto = {
      id: editCategory.id,
      description: editCategory.description,
      iconPath: editCategory.iconPath,
      accessRolesDto: editCategory.accessRoles,
      parentId: editCategory.parentId,
    };
    console.log("Отправка updateCategoryDto на сервер:", updateCategoryDto);
    try {
      const updateSuccess = await updateCategory(editCategory.id, updateCategoryDto);
      if (updateSuccess) {
        showSuccess('Категория обновлена');
        setShowEditModal(false);
        setEditingCategory(null);
        setEditCategory({ id: null, description: '', iconPath: '', accessRoles: [], parentId: null });
        if (!isNaN(categoryId)) {
          await fetchChildCategories(categoryId);
        }
        await fetchCategories();
      } else {
        showError('Ошибка при обновлении категории');
      }
    } catch (error) {
      console.error("Ошибка при редактировании категории:", error);
      showError('Ошибка при обновлении категории: ' + (error.message || ''));
    }
  };

  // === Удаление категории ===
  const handleSoftDelete = (categoryIdToDelete, description) => {
    setConfirmModal({
      isOpen: true,
      title: 'Отключение категории',
      message: `Вы уверены, что хотите отключить категорию "${description}"?`,
      onConfirm: async () => {
        try {
          const success = await softDeleteCategory(categoryIdToDelete, true);
          if (success) {
            showSuccess('Категория отключена');
            if (categoryIdToDelete === categoryId) {
              await fetchChildCategories(categoryId);
            } else {
              const categoryToDelete = categories.find(c => c.id === categoryIdToDelete);
              if (categoryToDelete && categoryToDelete.parentId) {
                await fetchChildCategories(categoryToDelete.parentId);
              } else {
                await fetchCategories();
              }
            }
          } else {
            showError('Ошибка при отключении категории');
          }
        } catch (error) {
          console.error("Ошибка при отключении категории:", error);
          showError('Ошибка при отключении категории: ' + (error.message || ''));
        } finally {
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      },
    });
  };

  // === Определяем, должен ли пользователь видеть кнопки создания ===
  // Показываем кнопки, если:
  // 1. Пользователь админ (ADMIN)
  // 2. ИЛИ пользователь писатель (WRITER) И проверка прав завершена И есть права на редактирование
  const showCreateButtons = useMemo(() => {
    return isAuthenticated && (
      hasRole('ADMIN') ||
      (hasRole('WRITER') && !isWriterPermissionLoading && canWriterEdit === true)
    );
  }, [isAuthenticated, hasRole, isWriterPermissionLoading, canWriterEdit]);

  // Показываем загрузку если данные еще не загружены
  if (localLoading || categoriesLoading || (isNaN(categoryId))) {
    return (
      <div className="knowledgehub-empty-articles-state">
        <div className="knowledgehub-loader-spinner">
          <div className="knowledgehub-spinner-ring"></div>
          <p>Загрузка категории...</p>
        </div>
      </div>
    );
  }

  // Если категория не найдена
  if (!currentCategory && !localLoading && categories.length > 0) {
    return (
      <div className="knowledgehub-empty-articles-state">
        <h3>Категория не найдена</h3>
        <p>Попробуйте вернуться назад.</p>
      </div>
    );
  }

  // Если категория еще загружается
  if (!currentCategory) {
    return (
      <div className="knowledgehub-empty-articles-state">
        <div className="knowledgehub-loader-spinner">
          <div className="knowledgehub-spinner-ring"></div>
          <p>Загрузка категории...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="knowledgehub-category-view">
      {/* Заголовок */}
      <header className="knowledgehub-category-header">
        <div className="knowledgehub-header-container">
          <h1 className="knowledgehub-category-title">
            {currentCategory.description || 'Описание отсутствует.'}
          </h1>
          <div className="knowledgehub-category-meta">
            <span className="knowledgehub-article-count">
              {filteredArticles.length} {getArticleWord(filteredArticles.length)}
            </span>
          </div>
        </div>
        {/* Поиск внутри категории */}
        <div className="knowledgehub-category-search">
          <div className="knowledgehub-search-wrapper">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
              className="knowledgehub-search-icon"
            >
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
            </svg>
            <input
              type="text"
              placeholder="Поиск по статьям в категории..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="knowledgehub-search-input"
            />
            {searchQuery && (
              <button className="knowledgehub-clear-search" onClick={clearSearch}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Навигационная панель с кнопками "Назад" и "Вперёд" */}
      <div className="knowledgehub-breadcrumb-navigation">
        <div className="knowledgehub-back-forward-controls">
          <button
            onClick={handleBack}
            className="knowledgehub-back-btn"
            aria-label="Назад"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M15 8a.5.5 0 0 1-.5-.5H7.707l1.147-1.147a.5.5 0 0 0-.707-.707l-3 3a.5.5 0 0 0 0 .707l3 3a.5.5 0 0 0 .707-.707L7.707 9.5H14.5A.5.5 0 0 1 15 10v-2z" />
            </svg>
          </button>
          <button
            onClick={handleForward}
            className="knowledgehub-forward-btn"
            aria-label="Вперёд"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 8a.5.5 0 0 1 .5-.5H8.707l-1.147-1.147a.5.5 0 0 1 .707-.707l3 3a.5.5 0 0 1 0 .707l-3 3a.5.5 0 0 1-.707-.707L8.707 9.5H1.5A.5.5 0 0 1 1 9v-1z" />
            </svg>
          </button>
        </div>
        {/* Хлебные крошки */}
        <nav aria-label="Навигация по категориям">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/" className="breadcrumb-link">
                <span className="breadcrumb-text">Категории</span>
              </Link>
            </li>
            {categoryPath.map((category, index) => {
              const isLast = index === categoryPath.length - 1;
              return (
                <li key={category.id} className={`breadcrumb-item ${isLast ? 'active' : ''}`}>
                  {isLast ? (
                    <span className="breadcrumb-text" aria-current="page">
                      {category.description}
                    </span>
                  ) : (
                    <Link
                      to={`/category/${category.id}`}
                      className="breadcrumb-link"
                    >
                      <span className="breadcrumb-text">{category.description}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      {/* Условно отображаем кнопки создания */}
      {showCreateButtons && (
        <div className="knowledgehub-create-buttons">
          <button
            className="knowledgehub-create-btn"
            onClick={() => openCreateChildModal(currentCategory)}
          >
            <Plus size={16} /> Создать подкатегорию
          </button>
          <Link
            to={`/create-article?categoryId=${categoryId}`}
            className="knowledgehub-create-btn"
          >
            <Plus size={16} /> Создать статью
          </Link>
        </div>
      )}

      {/* Дочерние категории */}
      {currentChildCategories.length > 0 && (
        <section className="knowledgehub-subcategories-section">
          <h2 className="knowledgehub-subcategories-title">Подкатегории</h2>
          <div className="knowledgehub-articles-grid-layout">
            {currentChildCategories.map((subcategory) => (
              <div
                key={subcategory.id}
                className="knowledgehub-article-card-wrapper"
              >
                <Link
                  to={`/category/${subcategory.id}`}
                  className="knowledgehub-article-card"
                >
                  <div className="knowledgehub-article-card-content">
                    <div className="knowledgehub-article-card-header">
                      <div className="knowledgehub-article-icon">
                        {subcategory.iconPath ? (
                          <img
                            src={subcategory.iconPath}
                            alt={subcategory.description}
                            className="knowledgehub-article-icon-img"
                          />
                        ) : (
                          <div className="knowledgehub-article-icon-placeholder">
                            <Folder size={30} />
                          </div>
                        )}
                      </div>
                      <h3 className="knowledgehub-article-kat-title">
                        {subcategory.description}
                      </h3>
                    </div>
                    <div className="knowledgehub-article-card-meta">
                      <span className="knowledgehub-article-card-category">
                        Подкатегория
                      </span>
                    </div>
                  </div>
                </Link>
                {/* Выпадающее меню для подкатегории */}
                {isAuthenticated && (hasRole('ADMIN') || (hasRole('WRITER') && canWriterEdit)) && (
                  <div className="knowledgehub-dropdown-container">
                    <button
                      className='drop_down_menu'
                      onClick={(e) => toggleDropdown(subcategory.id, e)}
                      aria-haspopup="true"
                      aria-expanded={openDropdownId === subcategory.id}
                    >
                      ...
                    </button>
                    {openDropdownId === subcategory.id && (
                      <div
                        className="knowledgehub-dropdown-menu"
                        ref={(el) => (dropdownRefs.current[subcategory.id] = el)}
                      >
                        <button
                          className="knowledgehub-dropdown-item"
                          onClick={() => openEditForm(subcategory)}
                        >
                          <Edit size={16} /> Редактировать
                        </button>
                        <button
                          className="knowledgehub-dropdown-item"
                          onClick={() => handleSoftDelete(subcategory.id, subcategory.description)}
                        >
                          <EyeOff size={16} /> Отключить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Список статей */}
      <main className="knowledgehub-articles-section">
        <h2 className="knowledgehub-subcategories-title">Статьи</h2>
        {articlesLoading && !searchQuery ? (
          <div className="knowledgehub-loader-spinner">
            <div className="knowledgehub-spinner-ring"></div>
            <p>Загружаем статьи...</p>
          </div>
        ) : filteredArticles.length > 0 ? (
          <div className="knowledgehub-articles-grid-layout">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="knowledgehub-empty-articles-state">
            <h3>{searchQuery ? 'Ничего не найдено' : 'Статьи не найдены'}</h3>
            <p>
              {searchQuery
                ? `По запросу "${searchQuery}" ничего не найдено.`
                : 'В этой категории пока нет доступных статей.'}
            </p>
            {searchQuery && (
              <button className="knowledgehub-clear-search-btn" onClick={clearSearch}>
                Очистить поиск
              </button>
            )}
          </div>
        )}
      </main>
      {/* Модальное окно: создание */}
      {showCreateModal && (
        <div
          className="cmp-modal-overlay"
          aria-hidden={!showCreateModal}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="cmp-modal-content"
            role="dialog"
            aria-labelledby="cmp-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmp-modal-header">
              <h2 id="cmp-create-title">
                {newCategory.parentId
                  ? `Создать подкатегорию для "${parentCategory?.description}"`
                  : 'Создать новую категорию'}
              </h2>
              <button
                className="cmp-modal-close-btn"
                aria-label="Закрыть модальное окно"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="cmp-modal-form">
              {newCategory.parentId && (
                <div className="cmp-form-group">
                  <label>Родительская категория:</label>
                  <div className="parent-category-info">
                    <strong>{parentCategory?.description}</strong>
                  </div>
                </div>
              )}
              <div className="cmp-form-group">
                <label htmlFor="cmp-create-description">Название категории</label>
                <input
                  type="text"
                  id="cmp-create-description"
                  name="description"
                  value={newCategory.description}
                  onChange={handleCreateInputChange}
                  required
                />
              </div>
              <div className="cmp-form-group">
                <label htmlFor="cmp-create-iconPath">Путь к иконке</label>
                <input
                  type="text"
                  id="cmp-create-iconPath"
                  name="iconPath"
                  value={newCategory.iconPath}
                  onChange={handleCreateInputChange}
                />
              </div>
              <div className="cmp-form-group">
                <label>Роли доступа</label>
                <div className="cmp-access-roles-grid">
                  {accessRoles.length === 0 ? (
                    <span className="cmp-no-roles">Нет доступных ролей</span>
                  ) : (
                    accessRoles.map((role) => (
                      <label
                        key={role.id}
                        className="cmp-checkbox-label"
                        style={hasRole('WRITER') && role.title === 'FULL_ACCESS' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        <input
                          type="checkbox"
                          checked={isCreateAccessRoleSelected(role.id)}
                          onChange={(e) =>
                            handleCreateAccessRoleChange(role.id, role.title, e.target.checked)
                          }
                          disabled={hasRole('WRITER') && role.title === 'FULL_ACCESS'}
                        />
                        <span className="cmp-checkbox-custom"></span>
                        <span className="role-title">{role.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="cmp-form-actions">
                <button
                  type="button"
                  className="cmp-btn cmp-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="cmp-btn cmp-btn-primary">
                  {newCategory.parentId ? 'Создать подкатегорию' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Модальное окно: редактирование */}
      {showEditModal && editingCategory && (
        <div
          className="cmp-modal-overlay"
          aria-hidden={!showEditModal}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="cmp-modal-content"
            role="dialog"
            aria-labelledby="cmp-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmp-modal-header">
              <h2 id="cmp-edit-title">Редактировать категорию</h2>
              <button
                className="cmp-modal-close-btn"
                aria-label="Закрыть модальное окно"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditCategory} className="cmp-modal-form">
              <div className="cmp-form-group">
                <label htmlFor="cmp-edit-description">Название категории</label>
                <input
                  type="text"
                  id="cmp-edit-description"
                  name="description"
                  value={editCategory.description}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="cmp-form-group">
                <label htmlFor="cmp-edit-iconPath">Путь к иконке</label>
                <input
                  type="text"
                  id="cmp-edit-iconPath"
                  name="iconPath"
                  value={editCategory.iconPath}
                  onChange={handleEditInputChange}
                />
              </div>

              {/* === Начало замены select на дерево === */}
              <div className="cmp-form-group">
                <label>Родительская категория</label>
                <div className="category-selector" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <CategorySelectorTree
                    categories={categories.filter(cat => cat.id !== editingCategory.id)} // Исключаем редактируемую категорию
                    selectedCategoryId={editCategory.parentId ? String(editCategory.parentId) : ''}
                    onSelect={(selectedId) => {
                      // Преобразуем обратно в число или null
                      let parentIdValue = null;
                      if (selectedId !== '' && selectedId !== 'null') {
                        parentIdValue = parseInt(selectedId, 10);
                        if (isNaN(parentIdValue)) parentIdValue = null;
                      }
                      setEditCategory(prev => ({ ...prev, parentId: parentIdValue }));
                    }}
                  />
                </div>
              </div>
              {/* === Конец замены === */}

              <div className="cmp-form-group_role">
                <label>Роли доступа</label>
                <div className="cmp-access-roles-grid">
                  {accessRoles.length === 0 ? (
                    <span className="cmp-no-roles">Нет доступных ролей</span>
                  ) : (
                    accessRoles.map((role) => (
                      <label
                        key={role.id}
                        className="cmp-checkbox-label"
                        style={hasRole('WRITER') && role.title === 'FULL_ACCESS' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        <input
                          type="checkbox"
                          checked={isEditAccessRoleSelected(role.id)}
                          onChange={(e) =>
                            handleEditAccessRoleChange(role.id, role.title, e.target.checked)
                          }
                          disabled={hasRole('WRITER') && role.title === 'FULL_ACCESS'}
                        />
                        <span className="cmp-checkbox-custom"></span>
                        <span className="role-title">{role.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="cmp-form-actions">
                <button
                  type="button"
                  className="cmp-btn cmp-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="cmp-btn cmp-btn-primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Модальное окно: подтверждение */}
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
export default CategoryPage;