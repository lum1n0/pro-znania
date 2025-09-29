// src/component/HomePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useArticleStore } from '../store/articleStore';
import { useCategoryStore } from '../store/categoryStore';
import { useAuthStore } from '../store/authStore';
import { BookOpen, Search, Folder } from 'lucide-react';
import { logAction } from '../api/logClient';
import '../style/HomePage.css';

const HomePage = () => {
  const { user, hasRole, isAuthenticated } = useAuthStore();
  const {
    articles,
    searchArticles,
    fetchAllArticles,
    fetchGuestArticles,
    searchGuestArticles,
    searchArticlesForUser,
    searchArticlesForAdmin,
    error: articleError
  } = useArticleStore();
  const { categories, fetchCategories, error: categoryError } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const heroRef = useRef(null);
  const formRef = useRef(null);
  const cardsRef = useRef([]);
  const navigate = useNavigate();

  const isAdminOrWriter = hasRole('ADMIN') || hasRole('WRITER');

  // Выбираем метод загрузки статей в зависимости от авторизации
  const fetchArticles = isAuthenticated ? fetchAllArticles : null;

  const extractTextFromQuill = (content) => {
    if (!content) return '';
    let ops;
    try {
      ops = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      ops = { ops: [] };
    }
    if (Array.isArray(ops.ops)) {
      return ops.ops
        .map(op => typeof op.insert === 'string' ? op.insert : '')
        .join(' ');
    }
    return '';
  };

  // Анимации
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js';
    script.async = true;
    script.onload = () => {
      initializeAnimations();
    };
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const initializeAnimations = () => {
    if (typeof window.anime === 'undefined') return;
    window.anime({
      targets: heroRef.current,
      translateY: [-50, 0],
      opacity: [0, 1],
      duration: 1000,
      easing: 'easeOutCubic',
    });
    window.anime({
      targets: formRef.current,
      scale: [0.9, 1],
      opacity: [0, 1],
      duration: 800,
      delay: 200,
      easing: 'easeOutBack',
    });
    window.anime({
      targets: '.breathing-icon',
      scale: [1, 1.1, 1],
      duration: 2000,
      easing: 'easeInOutSine',
      loop: true,
      direction: 'alternate',
    });
  };

  // Загрузка категорий для всех
  useEffect(() => {
  if (isAuthenticated) {
    // Авторизованные: свои или все категории
    fetchCategories();
  } else {
    // Гости: только гостевые категории
    useCategoryStore.getState().fetchGuestCategories();
  }
}, [isAuthenticated, fetchCategories]);
  // Загрузка статей ТОЛЬКО для авторизованных
  useEffect(() => {
    if (isAuthenticated && fetchArticles) {
      fetchArticles();
    }
  }, [isAuthenticated, fetchArticles]);

  // Серверный поиск с дебаунсом
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (!isAuthenticated) {
        await searchGuestArticles(searchQuery);
      } else if (isAdminOrWriter) {
        await searchArticlesForAdmin(searchQuery);
      } else {
        await searchArticlesForUser(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isAuthenticated, isAdminOrWriter, searchGuestArticles, searchArticlesForUser, searchArticlesForAdmin]);

  // Обновление подсказок
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = searchArticles
      .filter(article => !article.isDelete)
      .map(article => ({
        id: article.id,
        title: article.title,
        categoryDescription: article.categoryDto?.description || article.category?.description || 'Без категории',
      }))
      .slice(0, 8);

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [searchArticles, searchQuery]);

  // Управление клавиатурой и кликами
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveSuggestion(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveSuggestion(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[activeSuggestion]) {
            logAction('INFO', 'HOME_SEARCH_SELECT', 'Выбор статьи из поиска', { articleId: suggestions[activeSuggestion].id });
            navigate(`/article/${suggestions[activeSuggestion].id}`);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    };

    const handleClickOutside = (e) => {
      if (
        searchInputRef.current && !searchInputRef.current.contains(e.target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions, suggestions, activeSuggestion, navigate]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (id) => {
    logAction('INFO', 'HOME_SUGGESTION_CLICK', 'Клик по подсказке поиска', { articleId: id });
    navigate(`/article/${id}`);
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  // Популярные статьи — только если авторизован и есть статьи
  const popularArticles = isAuthenticated
    ? articles
        .filter(article => !article.isDelete)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 4)
    : [];

  // Основные категории — для всех
  const mainCategories = categories.filter(cat => !cat.isDelete).slice(0, 4);

  return (
    <div className="home-page">
      <div className="home-background"></div>
      <div className="home-container">
        {/* Главный блок */}
        <section className="hero-section" ref={heroRef}>
          <h1 className="hero-title">
            Добро пожаловать в Базу знаний, {user?.firstName || 'Пользователь'}! 👋
          </h1>
          <p className="hero-subtitle">
            Здесь вы найдёте всё, что нужно для эффективной работы: инструкции, руководства и ответы на частые вопросы.
          </p>
          <div className="search-form" ref={formRef}>
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon breathing-icon" />
              <input
                type="text"
                placeholder="Начните вводить, чтобы найти статью..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                className="search-input"
                ref={searchInputRef}
              />
            </div>
            {showSuggestions && (
              <ul className="suggestions-list" ref={suggestionsRef}>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id}
                    className={`suggestion-item ${index === activeSuggestion ? 'active' : ''}`}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    onClick={() => handleSuggestionClick(suggestion.id)}
                  >
                    <div className="suggestion-title">
                      {highlightMatch(suggestion.title, searchQuery)}
                    </div>
                    <div className="suggestion-category">
                      Категория: {suggestion.categoryDescription}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Контент для авторов */}
        {isAdminOrWriter ? (
          <section className="section creator-guide">
            <h2 className="section-title">
              <BookOpen size={20} className="breathing-icon" /> Как создать статью в Базе знаний
            </h2>
            <div className="guide-steps">
              <div className="guide-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Определите целевую группу пользователей</h3>
                  <p>Решите, для какой группы людей будет предназначена создаваемая инструкция.</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Создайте роль доступа</h3>
                  <p>Перейдите в раздел «Управление ролями» и создайте необходимую роль доступа.</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Создайте категорию</h3>
                  <p>Создайте категорию, в которой будет храниться инструкция, связав её с выбранной ролью доступа.</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Создайте инструкцию</h3>
                  <p>При создании инструкции:</p>
                  <ul>
                    <li>Укажите название</li>
                    <li>Заполните текст инструкции</li>
                    <li>По необходимости прикрепите файлы или видео</li>
                  </ul>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">PS</div>
                <div className="step-content">
                  <h3>Копирования с Word</h3>
                  <p>Важно! При копировании материалов из Word рекомендуем вставлять текст и изображения отдельно, чтобы избежать проблем с отображением фотографий.</p>
                </div>
              </div>
            </div>
            <div className="guide-cta">
              <Link to="/create-article" className="btn-primary">
                Создать статью
              </Link>
            </div>
          </section>
        ) : (
          <>
           

            {/* Основные категории — для всех */}
            {!searchQuery && mainCategories.length > 0 && (
              <section className="section">
                <h2 className="section-title">
                  <Folder size={20} /> Основные категории
                </h2>
                <div className="categories-grid">
                  {mainCategories.map((category) => (
                    <Link
                      to={`/category/${category.id}`}
                      key={category.id}
                      className="category-preview"
                    >
                      {category.iconPath ? (
                        <img src={category.iconPath} alt={category.description} className="category-icon" />
                      ) : (
                        <div className="no-icon">📁</div>
                      )}
                      <span className='category_disp'>{category.description}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Нет результатов поиска */}
        {searchQuery && suggestions.length === 0 && (
          <section className="section no-results">
            <p>Ничего не найдено по вашему запросу.</p>
          </section>
        )}
      </div>
    </div>
  );
};

export default HomePage;