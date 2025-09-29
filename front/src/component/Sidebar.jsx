// src/component/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useArticleStore } from '../store/articleStore';
import { useSidebarStore } from '../store/sidebarStore';
import {
  Home,
  Folder,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  Users,
  ShieldCheck,
  MessageSquare,
  Edit,
  Settings,
  ChevronLeft
} from 'lucide-react';
import '../style/Sidebar.css';

// ✅ Функция сортировки категорий
const sortCategories = (categories) => {
  return [...categories].sort((a, b) => {
    // Категория "Компас Сотрудника" всегда первая
    if (a.description === "Компас Сотрудника") return -1;
    if (b.description === "Компас Сотрудника") return 1;
    // Категория с id 1 вторая
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    // Остальные по убыванию id
    return b.id - a.id;
  });
};

// ✅ Функция фильтрации - только родительские категории
const filterParentCategories = (categories) => {
  return categories.filter(category => !category.parentId);
};

const Sidebar = () => {
  const location = useLocation();
  const { hasRole, isAuthenticated, userId } = useAuthStore();

  const {
    sidebarCategories,
    fetchAllCategoriesForSidebar,
    isLoading,
    error
  } = useCategoryStore();

  const {
    articles,
    fetchArticlesByCategory,
    fetchAllArticlesByCategoryForAdmin,
    searchArticlesForUser,
    searchArticlesForAdmin
  } = useArticleStore();

  const { isOpen, isCollapsed, toggleOpen, toggleCollapsed } = useSidebarStore();

  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Сохранение состояния раскрытия "Категории"
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-categories-open');
    return saved === null ? true : JSON.parse(saved);
  });

  useEffect(() => {
    localStorage.setItem('sidebar-categories-open', JSON.stringify(isCategoriesOpen));
  }, [isCategoriesOpen]);

  const isActivePath = (path) => location.pathname === path;

  // Загружаем ВСЕ категории для Sidebar (без пагинации)
  useEffect(() => {
    if (isAuthenticated && userId) {
      fetchAllCategoriesForSidebar(userId);
    }
  }, [isAuthenticated, userId, fetchAllCategoriesForSidebar]);

  // Поиск
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const isAdmin = hasRole('ADMIN');
      if (isAdmin) {
        await searchArticlesForAdmin(searchQuery);
      } else {
        await searchArticlesForUser(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchArticlesForUser, searchArticlesForAdmin, hasRole]);

  useEffect(() => {
    if (searchQuery.trim() !== '') {
      const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [articles, searchQuery]);

  // Обработка ресайза
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      useSidebarStore.getState().setOpen(!isMobile);
      useSidebarStore.getState().setCollapsed(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
      const isAdmin = hasRole('ADMIN');
      if (isAdmin || hasRole('WRITER')) {
        fetchAllArticlesByCategoryForAdmin(categoryId);
      } else {
        fetchArticlesByCategory(categoryId);
      }
    }
    setExpandedCategories(newExpanded);
  };

  const getArticlesForCategory = (categoryId) => {
    return articles.filter((article) => {
      const articleCategoryId = article.categoryDto?.id || article.categoryId;
      return Number(articleCategoryId) === Number(categoryId);
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const isActiveCategory = (categoryId) => {
    return location.pathname === `/category/${categoryId}`;
  };

  // ✅ Фильтруем и сортируем категории - только родительские
  const parentCategories = filterParentCategories(sidebarCategories);
  const sortedCategories = sortCategories(parentCategories);

  if (!isAuthenticated) return null;

  return (
    <>
      <div className={`kb-sidebar ${isCollapsed ? 'kb-sidebar-collapsed' : ''} ${isOpen ? 'open' : ''}`}>
        <div className="kb-sidebar-header">
          <h3 className="kb-sidebar-brand">
            <Folder size={20} />
            <span>База знаний</span>
          </h3>
          <button className="kb-sidebar-toggle" onClick={toggleCollapsed}>
            <ChevronLeft size={16} className="kb-toggle-icon" />
          </button>
        </div>
        <ul className="kb-nav-list">
          {/* Главная */}
          <li className="kb-nav-item">
            <Link to="/" className={`kb-nav-link ${location.pathname === '/' ? 'kb-active' : ''}`}>
              <Home size={16} className="kb-nav-icon" />
              <span>Главная</span>
            </Link>
          </li>

          {/* Поиск */}
          <li className="kb-nav-item kb-search-item">
            <div className="kb-search-wrapper">
              <Search size={14} className="kb-search-icon" />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="kb-search-input"
              />
              {searchQuery && (
                <button className="kb-clear-search" onClick={clearSearch}>
                  <X size={12} />
                </button>
              )}
            </div>
          </li>

          {/* Результаты поиска */}
          {searchQuery && (
            <ul className="kb-search-results">
              {searchResults.length > 0 ? (
                searchResults.map((article) => (
                  <li key={article.id} className="kb-dropdown-item-wrapper">
                    <Link
                      to={`/article/${article.id}`}
                      className={`kb-dropdown-link ${isActiveCategory(article.id) ? 'kb-active' : ''} ${article.isDelete ? 'kb-deleted' : ''}`}
                    >
                      <FileText size={14} />
                      {article.title}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="kb-dropdown-item-wrapper">
                  <span className="kb-dropdown-link">Не найдено</span>
                </li>
              )}
            </ul>
          )}

          {/* Категории — с возможностью сворачивания */}
          {!searchQuery && (
            <li className={`kb-dropdown ${isCategoriesOpen ? 'kb-active-dropdown' : ''}`}>
              <div
                className="kb-nav-item kb-dropdown-toggle"
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                style={{ cursor: 'pointer' }}
              >
                <a  className="kb-nav-item-content">
                  <Folder size={16} className="kb-nav-icon" />
                  <span>Категории</span>
                </a>
                {isCategoriesOpen ? (
                  <ChevronDown className="kb-dropdown-icon kb-rotate-down" />
                ) : (
                  <ChevronRight className="kb-dropdown-icon" />
                )}
              </div>

              {/* Меню категорий */}
              {isCategoriesOpen && (
                <ul className="kb-dropdown-menu">
                  {isLoading ? (
                    <li className="kb-dropdown-item-wrapper">
                      <span className="kb-dropdown-link">Загрузка...</span>
                    </li>
                  ) : error ? (
                    <li className="kb-dropdown-item-wrapper">
                      <span className="kb-dropdown-link kb-error">Ошибка</span>
                    </li>
                  ) : sortedCategories.length === 0 ? (
                    <li className="kb-dropdown-item-wrapper">
                      <span className="kb-dropdown-link">Нет доступных категорий</span>
                    </li>
                  ) : (
                    sortedCategories.map((category) => (
                      <li key={category.id} className="kb-category-item">
                        <Link
                          to={`/category/${category.id}`}
                          className={`kb-dropdown-link kb-category-header ${isActivePath(`/category/${category.id}`) ? 'kb-active' : ''} ${category.isDelete ? 'kb-deleted' : ''}`}
                        >
                          {category.iconPath ? (
                            <img src={category.iconPath} alt={category.description} className="category-icon1" />
                          ) : (
                            <Folder size={14} className="category-icon1" />
                          )}
                          {category.description}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          )}
        </ul>
      </div>
      {isOpen && <div className="sidebar-overlay" onClick={toggleOpen} />}
    </>
  );
};

export default Sidebar;