import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useAuthStore } from '../store/authStore';
import { articleAPI } from '../api/apiServese';
import '../style/CategoryPage.css';

const AllCategoriesPage = () => {
  const navigate = useNavigate();

  const {
    categories,
    fetchGuestCategories,
    fetchCategories,
    fetchAllCategories,
    fetchCategoriesForUser,
    searchCategoriesForUser,
    searchCategoriesForAdmin,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategoryStore();

  const { isAuthenticated } = useAuthStore();

  const [articleCounts, setArticleCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [displayedCategories, setDisplayedCategories] = useState([]);
  const [originalCategories, setOriginalCategories] = useState([]);

  // Загрузка категорий при монтировании и при изменении авторизации
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { userId, hasRole } = useAuthStore.getState(); // ✅ Получаем внутри
        let loadedCategories = [];

        if (isAuthenticated) {
          if (hasRole('ADMIN')) {
            await fetchAllCategories();
          } else if (hasRole('WRITER') && userId) {
            await fetchCategoriesForUser(userId);
          } else {
            await fetchCategories();
          }
          loadedCategories = useCategoryStore.getState().categories;
        } else {
          await fetchGuestCategories();
          loadedCategories = useCategoryStore.getState().categories;
        }

        setOriginalCategories(loadedCategories);
        setDisplayedCategories(loadedCategories);
      } catch (err) {
        console.error('Ошибка загрузки категорий:', err);
      }
    };

    loadCategories();
  }, [
    isAuthenticated,
    fetchCategories,
    fetchGuestCategories,
    fetchAllCategories,
    fetchCategoriesForUser,
  ]);

  // При изменении основного списка — обновляем отображаемые
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setDisplayedCategories(originalCategories); // ✅ Всегда возвращаем original
    }
  }, [searchQuery, originalCategories]);

  // Загрузка количества статей
  useEffect(() => {
    if (displayedCategories.length > 0) {
      const loadArticleCounts = async () => {
        const counts = {};
        try {
          for (const category of displayedCategories) {
            let count = 0;
            try {
              if (isAuthenticated) {
                const response = await articleAPI.getArticlesByCategory(category.id);
                count = Array.isArray(response.data)
                  ? response.data.length
                  : response.data?.content?.length || 0;
              } else {
                const response = await articleAPI.getGuestArticlesByCategory(category.id);
                count = Array.isArray(response.data)
                  ? response.data.length
                  : response.data?.content?.length || 0;
              }
            } catch (err) {
              console.warn(`Ошибка при загрузке статей для категории ${category.id}:`, err);
              count = 0;
            }
            counts[category.id] = count;
          }
          setArticleCounts(counts);
        } catch (err) {
          console.error('Ошибка при загрузке количества статей:', err);
        }
      };

      loadArticleCounts();
    }
  }, [displayedCategories, isAuthenticated]);

  // Поиск с задержкой
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setDisplayedCategories(originalCategories); // ✅ Возвращаем оригинальные
      setIsSearching(false);
      return;
    }

    const delayDebounce = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]); // ✅ Только searchQuery

  // Функция поиска
  const handleSearch = async (query) => {
    if (query.trim() === '') {
      setDisplayedCategories(originalCategories);
      return;
    }

    setIsSearching(true);

    try {
      const { userId, hasRole } = useAuthStore.getState(); // ✅ Получаем внутри
      let searchResult = [];

      if (isAuthenticated && userId) {
        if (hasRole('ADMIN')) {
          const response = await searchCategoriesForAdmin(query);
          if (response?.data) {
            searchResult = Array.isArray(response.data)
              ? response.data
              : response.data.content || [];
          }
        } else {
          const response = await searchCategoriesForUser(query, userId);
          if (response?.data) {
            searchResult = Array.isArray(response.data)
              ? response.data
              : response.data.content || [];
          }
        }
      } else {
        // Гость — локальный поиск
        const filtered = originalCategories.filter((cat) =>
          cat.description?.toLowerCase().includes(query.toLowerCase())
        );
        searchResult = filtered;
      }

      setDisplayedCategories(searchResult);
    } catch (err) {
      console.error('Ошибка поиска категорий:', err);
      setDisplayedCategories([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Очистка поиска
  const handleClearSearch = () => {
    setSearchQuery('');
    setDisplayedCategories(originalCategories); // ✅ Возвращаем оригинальные
  };

  // Отправка формы
  const handleSearchSubmit = (e) => {
    e.preventDefault();
  };

  // Клик по категории
  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  // Счётчик статей
  const getArticleCount = (categoryId) => {
    return articleCounts[categoryId] || 0;
  };

  // Склонение
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

  const categoriesToShow = searchQuery.trim() === '' ? originalCategories : displayedCategories;

  // Загрузка
  if (categoriesLoading && !isSearching) {
    return (
      <div className="knowledgehub-category-view">
        <div className="knowledgehub-loader-spinner">
          <div className="knowledgehub-spinner-ring"></div>
          <p>Загружаем категории...</p>
        </div>
      </div>
    );
  }

  // Ошибка
  if (categoriesError && !isSearching) {
    return (
      <div className="knowledgehub-category-view">
        <div className="knowledgehub-empty-articles-state">
          <h3>Ошибка загрузки</h3>
          <p>{categoriesError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="knowledgehub-category-view">
      {/* Заголовок */}
      <header className="knowledgehub-category-header">
        <div className="knowledgehub-header-container">
          <h1 className="knowledgehub-category-title">Все категории</h1>

          {/* Поиск */}
          <div className="knowledgehub-category-search">
            <form onSubmit={handleSearchSubmit}>
              <div className="knowledgehub-search-wrapper">
                <svg
                  className="knowledgehub-search-icon"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                </svg>
                <input
                  type="text"
                  className="knowledgehub-search-input"
                  placeholder="Поиск категорий..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="knowledgehub-clear-search"
                    onClick={handleClearSearch}
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
            {isSearching && searchQuery && (
              <div className="knowledgehub-loader-spinner" style={{ padding: '0.5rem 0' }}>
                <div
                  className="knowledgehub-spinner-ring"
                  style={{ width: '20px', height: '20px', borderWidth: '2px' }}
                ></div>
              </div>
            )}
          </div>

          <div className="knowledgehub-category-meta">
            <span className="knowledgehub-article-count">
              {categoriesToShow.length} {categoriesToShow.length === 1 ? 'категория' : 'категорий'}
            </span>
          </div>
        </div>
      </header>

      {/* Список категорий */}
      <main className="knowledgehub-articles-section">
        {categoriesToShow.length > 0 ? (
          <div className="knowledgehub-articles-grid-layout">
            {categoriesToShow.map((category) => (
              <div
                key={category.id}
                className="knowledgehub-category-card"
                onClick={() => handleCategoryClick(category.id)}
              >
                <div className="knowledgehub-category-card-content">
                  <h3 className="knowledgehub-category-card-title">
                    {category.description || 'Без названия'}
                  </h3>
                  <div className="knowledgehub-category-card-meta">
                    <span className="knowledgehub-category-article-count">
                      {getArticleCount(category.id)} {getArticleWord(getArticleCount(category.id))}
                    </span>
                  </div>
                </div>
                <div className="knowledgehub-category-card-arrow">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8z"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="knowledgehub-empty-articles-state">
            <img
              src="/images/search-empty.svg"
              alt="Нет категорий"
              className="knowledgehub-empty-icon"
            />
            <h3>
              {searchQuery ? 'Категории не найдены' : 'Категории не найдены'}
            </h3>
            <p>
              {searchQuery
                ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте другой запрос.`
                : 'Пока нет доступных категорий.'}
            </p>
            {searchQuery && (
              <button
                className="knowledgehub-clear-search-btn"
                onClick={handleClearSearch}
              >
                Очистить поиск
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AllCategoriesPage;