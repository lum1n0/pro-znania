
import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import { useAccessRoleStore } from '../store/accessRoleStore';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Link as LinkIcon, Search, X } from 'lucide-react';
import { showSuccess, showError, showWarning } from '../utils/toastUtils';
import '../style/CategoryManagementPage.css';
import { logAction } from '../api/logClient';
import ConfirmationModal from '../component/ConfirmationModal';

const CategoryManagementPage = () => {
  // Получаем данные авторизации
  const { hasRole, userId, isAuthChecked } = useAuthStore();
  const {
    categories,
    fetchAllCategories,
    createCategory,
    updateCategory,
    softDeleteCategory,
    hardDeleteCategory,
    isLoading,
    error,
    fetchCategoriesForUser,
    moveCategory,
    childCategories,
    searchCategoriesForAdmin,
    searchCategoriesForUser
  } = useCategoryStore();
  const { accessRoles, fetchAllAccessRoles } = useAccessRoleStore();
  const { fetchAllArticlesByCategoryForAdmin, articles } = useArticleStore();

  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // ✅ Добавлено состояние для родительской категории
  const [parentCategory, setParentCategory] = useState(null);

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

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [pagination, setPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    size: 10,
  });

  // ✅ Состояние для поиска
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const hasAccess = hasRole('ADMIN') || hasRole('WRITER');
  const isOwnerOrAdmin = hasRole('ADMIN');

  // ✅ Эффект для поиска
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setIsSearching(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        if (hasRole('ADMIN')) {
          await searchCategoriesForAdmin(searchQuery);
        } else if (hasRole('WRITER') && userId) {
          await searchCategoriesForUser(searchQuery, userId);
        }
        setIsSearching(true);
      } catch (err) {
        console.error('Ошибка поиска категорий:', err);
        showError('Ошибка поиска категорий');
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, hasRole, userId, searchCategoriesForAdmin, searchCategoriesForUser]);

  // Основной эффект: загрузка категорий и ролей
  useEffect(() => {
    const loadCategories = async () => {
      // Ждём, пока авторизация будет проверена
      if (!isAuthChecked) return;

      if (!hasAccess) {
        showError('Доступ к управлению категориями запрещён');
        return;
      }

      try {
        let response;

        if (hasRole('ADMIN')) {
          response = await fetchAllCategories(pagination.currentPage, pagination.size);
        } else if (hasRole('WRITER') && userId) {
          response = await fetchCategoriesForUser(userId, pagination.currentPage, pagination.size);
        } else {
          showError('Недостаточно прав для просмотра категорий');
          return;
        }

        // Обновляем общее количество страниц
        if (response?.data?.totalPages !== undefined) {
          setPagination((prev) => ({
            ...prev,
            totalPages: response.data.totalPages,
          }));
        }
      } catch (err) {
        console.error('Ошибка при загрузке категорий:', err);
        showError('Не удалось загрузить категории. Проверьте подключение.');
      }
    };

    // Загружаем категории
    loadCategories();

    // Загружаем роли доступа (не зависит от пользователя)
    fetchAllAccessRoles();
  }, [
    isAuthChecked,
    hasAccess,
    userId,
    pagination.currentPage,
    pagination.size,
  ]);

  // Обработка ошибок
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error]);

  // ✅ Переключение раскрытия категории
  const toggleCategory = async (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
      await fetchAllArticlesByCategoryForAdmin(categoryId);
      // ✅ Загружаем дочерние категории при раскрытии
      await useCategoryStore.getState().fetchChildCategories(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // ✅ Soft delete категории
  const handleSoftDelete = (categoryId, description) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удаление категории',
      message: `Вы уверены, что хотите удалить категорию "${description}"?`,
      onConfirm: async () => {
        const success = await softDeleteCategory(categoryId, true);
        if (success) {
          showSuccess('Категория удалена');
          setPagination({ currentPage: 0, totalPages: 0, size: pagination.size });
        } else {
          showError('Ошибка при удалении категории');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Удаление категории навсегда
  // В CategoryManagementPage.jsx
  const handleHardDelete = (categoryId, description) => {
    if (!isOwnerOrAdmin) {
      showWarning('Только администратор может удалять категории навсегда');
      return;
    }

    // Проверяем наличие статей в категории
    const categoryArticles = articles.filter(article => {
      const articleCategoryId = article.categoryId || article.categoryDto?.id;
      return Number(articleCategoryId) === Number(categoryId);
    });

    if (categoryArticles.length > 0) {
      showWarning(`Невозможно удалить категорию "${description}" — в ней содержатся ${categoryArticles.length} статьи(ей)`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Полное удаление категории',
      message: `Вы уверены, что хотите полностью удалить категорию "${description}"? Это действие нельзя отменить.`,
      onConfirm: async () => {
        try {
          const success = await hardDeleteCategory(categoryId);
          if (success) {
            showSuccess('Категория удалена навсегда');
            setPagination({ currentPage: 0, totalPages: 0, size: pagination.size });
          } else {
            showError('Ошибка при удалении категории');
          }
        } catch (error) {
          console.error('Ошибка при удалении категории:', error);
          showError('Ошибка при удалении категории: ' + (error.message || 'Неизвестная ошибка'));
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Восстановление категории
  const handleRestore = async (categoryId) => {
    const confirmed = window.confirm('Вы уверены, что хотите восстановить эту категорию?');
    if (confirmed) {
      const success = await softDeleteCategory(categoryId, false);
      if (success) {
        showSuccess('Категория восстановлена');
        setPagination({ currentPage: 0, totalPages: 0, size: pagination.size });
      } else {
        showError('Ошибка при восстановлении');
      }
    }
  };

  // ✅ Открытие модального окна создания дочерней категории
  const openCreateChildModal = (parentCategory, e) => {
    // Останавливаем всплытие события
    if (e) {
      e.stopPropagation();
    }
    setParentCategory(parentCategory);
    setNewCategory({
      description: '',
      iconPath: '',
      accessRoles: [],
      parentId: parentCategory.id,
    });
    setShowCreateModal(true);
  };

  // === Создание категории ===
  const handleCreateInputChange = (e) => {
    const { name, value } = e.target;
    setNewCategory({ ...newCategory, [name]: value });
  };

  const handleCreateAccessRoleChange = (roleId, roleTitle, isChecked) => {
    // ✅ Writer не может выбрать роль FULL_ACCESS
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

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const categoryDto = {
      description: newCategory.description,
      iconPath: newCategory.iconPath,
      accessRolesDto: newCategory.accessRoles,
      parentId: newCategory.parentId,
    };
    const success = await createCategory(categoryDto);
    if (success) {
      showSuccess(newCategory.parentId
        ? `Дочерняя категория "${newCategory.description}" создана`
        : `Категория "${newCategory.description}" создана`);
      setShowCreateModal(false);
      setParentCategory(null);
      setNewCategory({ description: '', iconPath: '', accessRoles: [], parentId: null });
      setPagination({ currentPage: 0, totalPages: 0, size: pagination.size });
    } else {
      showError('Ошибка при создании категории');
    }
  };

  // === Редактирование категории ===
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'parentId') {
      const parentIdValue = value === '' ? null : Number(value);
      setEditCategory({ ...editCategory, [name]: parentIdValue });
    } else {
      setEditCategory({ ...editCategory, [name]: value });
    }
  };

  const handleEditAccessRoleChange = (roleId, roleTitle, isChecked) => {
    // ✅ Writer не может выбрать роль FULL_ACCESS
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

  const openEditForm = (category, e) => {
    // Останавливаем всплытие события
    if (e) {
      e.stopPropagation();
    }
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

  const handleEditCategory = async (e) => {
    e.preventDefault();

    const updateCategoryDto = {
      description: editCategory.description,
      iconPath: editCategory.iconPath,
      accessRolesDto: editCategory.accessRoles,
    };

    try {
      const updateSuccess = await updateCategory(editCategory.id, updateCategoryDto);

      if (updateSuccess) {
        if (editingCategory && editCategory.parentId !== (editingCategory.parentId || null)) {
          await moveCategory(editCategory.id, editCategory.parentId);
        }

        showSuccess('Категория обновлена');
        setShowEditModal(false);
        setEditingCategory(null);
        setEditCategory({ id: null, description: '', iconPath: '', accessRoles: [], parentId: null });
      } else {
        showError('Ошибка при обновлении категории');
      }
    } catch (error) {
      console.error("Ошибка при редактировании категории:", error);
      showError('Ошибка при обновлении категории: ' + (error.message || ''));
    }
  };

  // ✅ Очистка поиска
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    // Перезагружаем все категории
    if (hasRole('ADMIN')) {
      fetchAllCategories(pagination.currentPage, pagination.size);
    } else if (hasRole('WRITER') && userId) {
      fetchCategoriesForUser(userId, pagination.currentPage, pagination.size);
    }
  };

  // Если нет доступа — редирект
  if (!isAuthChecked) {
    return <div className="loading">Проверка доступа...</div>;
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Получаем имя родительской категории по ID
  const getParentCategoryName = (parentId) => {
    if (!parentId) return null;
    const parent = categories.find(cat => cat.id === parentId);
    return parent ? parent.description : 'Неизвестная категория';
  };

  // ✅ Фильтруем категории для отображения в основном списке
  const displayCategories = searchQuery.trim() === '' 
    ? categories 
    : categories.filter(category => 
        category.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="category-management-page">
      <div className="container">
        <div className="page-header">
          <h1>Управление категориями</h1>
          <button
            className="add-category-btn"
            onClick={() => {
              setParentCategory(null);
              setNewCategory({ description: '', iconPath: '', accessRoles: [], parentId: null });
              setShowCreateModal(true);
            }}
            disabled={isLoading}
          >
            <Plus size={20} /> Добавить категорию
          </button>
        </div>

        {/* ✅ Поисковая строка */}
        <div className="search-container">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Поиск по категориям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={clearSearch}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Список категорий - отображаем все категории */}
        <div className="categories-list" key={`categories-page-${pagination.currentPage}`}>
          {isLoading && pagination.currentPage === 0 ? (
            <div className="loading">Загрузка категорий...</div>
          ) : displayCategories.length === 0 ? (
            <div className="no-categories">
              {searchQuery ? 'Категории не найдены' : 'Категории не найдены'}
            </div>
          ) : (
            displayCategories.map((category) => {
              const categoryArticles = articles.filter((article) => {
                const articleCategoryId = article.categoryId || article.categoryDto?.id;
                return Number(articleCategoryId) === Number(category.id);
              });
              const parentCategoryName = getParentCategoryName(category.parentId);
              return (
                <div
                  key={category.id}
                  className={`category-item ${category.isDelete ? 'deleted' : ''}`}
                >
                  <div className="category-header">
                    <button
                      className="toggle-btn"
                      onClick={() => toggleCategory(category.id)}
                      disabled={isLoading}
                    >
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                    <div className="category-info">
                      <div className="category-icon">
                        {category.iconPath ? (
                          <img src={category.iconPath} alt={category.description} />
                        ) : (
                          <div className="no-icon">Нет иконки</div>
                        )}
                      </div>
                      <div className="category-text-info">
                        <h3>{category.description}</h3>
                        {/* ✅ Отображаем информацию о родительской категории для всех пользователей */}
                        {parentCategoryName && (
                          <div className="category-parent-info">
                            <span className="parent-label">Родитель:</span>
                            <span className="parent-name">{parentCategoryName}</span>
                          </div>
                        )}
                        {category.isDelete && (
                          <span className="category-deleted-tag">(Удалено)</span>
                        )}
                      </div>
                    </div>
                    <div className="category-actions">
                      <button
                        className="add-child-btn"
                        onClick={(e) => openCreateChildModal(category, e)}
                        disabled={isLoading}
                        title="Создать дочернюю категорию"
                      >
                        <Plus size={14} className="svg" /> Подкатегория
                      </button>
                      <button
                        className="edit-btn"
                        onClick={(e) => openEditForm(category, e)}
                        disabled={isLoading}
                      >
                        <Edit size={16} className="svg" /> Редактировать
                      </button>
                      {/* ✅ Кнопка soft delete */}
                      {category.isDelete ? (
                        <button
                          className="restore-btn"
                          onClick={() => handleRestore(category.id)}
                          disabled={isLoading}
                        >
                          Восстановить
                        </button>
                      ) : (
                        <>
                          <button
                            className="soft-delete-btn"
                            onClick={() => handleSoftDelete(category.id, category.description)}
                            disabled={isLoading}
                            title="Удалить категорию"
                          >
                            Отключить
                          </button>
                          {isOwnerOrAdmin && (
                            <button
                              className="delete-btn"
                              onClick={() => handleHardDelete(category.id, category.description)}
                              disabled={isLoading}
                            >
                              Удалить навсегда
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {expandedCategories.has(category.id) && (
                    <div className="category-details">
                      {/* ✅ Отображаем дочерние категории здесь как ссылки */}
                      <div className="subcategories">
                        <h4>Подкатегории:</h4>
                        {childCategories[category.id] && childCategories[category.id].length > 0 ? (
                          <ul className="subcategories-list">
                            {childCategories[category.id].map((subCat) => {
                              // ✅ Получаем имя родительской категории для подкатегории
                              const subParentName = getParentCategoryName(subCat.parentId);
                              return (
                                <li key={subCat.id} className="subcategory-item">
                                  <div className="subcategory-content">
                                    {/* ✅ Сделали подкатегорию ссылкой */}
                                    <Link
                                      to={`/category/${subCat.id}`}
                                      className="subcategory-link"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {subCat.description}
                                    </Link>

                                  </div>
                                  {subCat.isDelete && <span className="subcategory-deleted-tag">(Удалено)</span>}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="no-subcategories">Нет подкатегорий</p>
                        )}
                      </div>
                      <div className="access-roles">
                        <h4>Роли доступа:</h4>
                        <ul>
                          {category.accessRolesDto &&
                            Array.isArray(category.accessRolesDto) &&
                            category.accessRolesDto.length > 0 ? (
                            category.accessRolesDto.map((role) => (
                              <li key={role.id}>{role.title}</li>
                            ))
                          ) : (
                            <li>Нет назначенных ролей</li>
                          )}
                        </ul>
                      </div>
                      <div className="articles">
                        <h4>Статьи:</h4>
                        <ul className="list_articles">
                          {categoryArticles.length > 0 ? (
                            categoryArticles.map((article) => (
                              <li
                                key={article.id}
                                className={article.isDelete ? 'deleted-article' : ''}
                              >
                                <a
                                  href={`/article/${article.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="article-link"
                                  title={article.title}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    logAction(
                                      'INFO',
                                      'ARTICLE_LINK_CLICK',
                                      'Клик по ссылке статьи в управлении категориями',
                                      {
                                        articleId: article.id,
                                        title: article.title,
                                        categoryId: category.id,
                                      }
                                    );
                                    window.open(`/article/${article.id}`, '_blank');
                                  }}
                                >
                                  {article.title}
                                </a>
                              </li>
                            ))
                          ) : (
                            <li>Нет статей в этой категории</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Пагинация */}
        {!isLoading && displayCategories.length > 0 && searchQuery.trim() === '' && (
          <div className="pagination-controls">
            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  currentPage: Math.max(0, prev.currentPage - 1),
                }))
              }
              disabled={pagination.currentPage === 0 || isLoading}
              className="pagination-btn prev"
            >
              ← Предыдущая
            </button>
            <span className="pagination-info">
              Страница {pagination.currentPage + 1} из {pagination.totalPages || 1}
            </span>
            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  currentPage: Math.min((pagination.totalPages || 1) - 1, prev.currentPage + 1),
                }))
              }
              disabled={pagination.currentPage >= (pagination.totalPages || 1) - 1 || isLoading}
              className="pagination-btn next"
            >
              Следующая →
            </button>
            <div className="pagination-size">
              <label>
                На странице:
                <select
                  value={pagination.size}
                  onChange={(e) => {
                    setPagination({
                      currentPage: 0,
                      totalPages: 0,
                      size: Number(e.target.value),
                    });
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
          </div>
        )}

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
                          // ✅ Writer не может выбрать FULL_ACCESS
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
                          {role.title}
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
                <div className="cmp-form-group">
                  <label htmlFor="cmp-edit-parentId">Родительская категория</label>
                  <select
                    id="cmp-edit-parentId"
                    name="parentId"
                    value={editCategory.parentId || ''}
                    onChange={handleEditInputChange}
                    className="cmp-form-select"
                  >
                    <option value="">Нет родителя (корневая)</option>
                    {categories
                      .filter(cat => cat.id !== editingCategory.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.description}
                        </option>
                      ))}
                  </select>
                </div>
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
                          // ✅ Writer не может выбрать FULL_ACCESS
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
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
};

export default CategoryManagementPage;