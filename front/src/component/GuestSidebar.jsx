// src/component/GuestSidebar.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCategoryStore } from '../store/categoryStore';
import { useArticleStore } from '../store/articleStore';
import { useSidebarStore } from '../store/sidebarStore';
import { ChevronDown, ChevronRight, FileText, Folder, Search, X, ChevronLeft } from 'lucide-react';
import '../style/GuestSidebar.css';

// ✅ Функция сортировки категорий
const sortCategories = (categories) => {
  return [...categories].sort((a, b) => {
    // Категория с id 1 всегда первая
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    // Остальные по убыванию id
    return b.id - a.id;
  });
};

const GuestSidebar = () => {
  // const { categories, fetchGuestCategories, isLoading, error } = useCategoryStore();
  // const { searchGuestArticles } = useArticleStore();

  // const { isOpen, isCollapsed, toggleOpen, toggleCollapsed, setOpen, setCollapsed } = useSidebarStore();
  // const [searchQuery, setSearchQuery] = useState('');
  // const [isSearching, setIsSearching] = useState(false);
  // const [searchResults, setSearchResults] = useState([]);

  // // Управление состоянием меню "Категории"
  // const [isCategoriesOpen, setIsCategoriesOpen] = useState(() => {
  //   const saved = localStorage.getItem('guest-sidebar-categories-open');
  //   return saved === null ? true : JSON.parse(saved);
  // });

  // useEffect(() => {
  //   localStorage.setItem('guest-sidebar-categories-open', JSON.stringify(isCategoriesOpen));
  // }, [isCategoriesOpen]);

  // // Handle resize for sidebar state
  // useEffect(() => {
  //   const handleResize = () => {
  //     const isMobile = window.innerWidth < 768;
  //     setOpen(!isMobile);
  //     setCollapsed(false);
  //   };

  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, [setOpen, setCollapsed]);

  // // Загружаем ТОЛЬКО категории
  // useEffect(() => {
  //   fetchGuestCategories();
  // }, [fetchGuestCategories]);

  // // Поиск — только при вводе
  // useEffect(() => {
  //   if (searchQuery.trim() === '') {
  //     setSearchResults([]);
  //     setIsSearching(false);
  //     return;
  //   }

  //   setIsSearching(true);
  //   const timeout = setTimeout(async () => {
  //     try {
  //       const response = await searchGuestArticles(searchQuery);
  //       setSearchResults(response.data);
  //     } catch (err) {
  //       console.error('Ошибка поиска:', err);
  //       setSearchResults([]);
  //     } finally {
  //       setIsSearching(false);
  //     }
  //   }, 300);

  //   return () => clearTimeout(timeout);
  // }, [searchQuery, searchGuestArticles]);

  // const clearSearch = () => {
  //   setSearchQuery('');
  //   setSearchResults([]);
  //   setIsSearching(false);
  // };

  // const isActiveCategory = (categoryId) => {
  //   return window.location.pathname === `/category/${categoryId}`;
  // };

  // // ✅ Сортируем категории
  // const sortedCategories = sortCategories(categories);

  // return (
  //   <>
  //     <div className={`guest-sidebar ${isCollapsed ? 'guest-sidebar-collapsed' : ''} ${isOpen ? 'open' : ''}`}>
  //       <div className="guest-sidebar-header">
  //         <h3 className="guest-sidebar-brand">
  //           <Folder size={20} />
  //           <span>База знаний</span>
  //         </h3>
  //         <button className="guest-sidebar-toggle" onClick={toggleCollapsed}>
  //           <ChevronLeft size={16} className="guest-toggle-icon" />
  //         </button>
  //       </div>

  //       <ul className="guest-nav-list">
  //         {/* Поиск */}
  //         <li className="guest-nav-item guest-search-item">
  //           <div className="guest-search-wrapper">
  //             <Search size={14} className="guest-search-icon" />
  //             <input
  //               type="text"
  //               className="guest-search-input"
  //               placeholder="Поиск статей..."
  //               value={searchQuery}
  //               onChange={(e) => setSearchQuery(e.target.value)}
  //             />
  //             {searchQuery && (
  //               <button className="guest-clear-search" onClick={clearSearch}>
  //                 <X size={12} />
  //               </button>
  //             )}
  //           </div>
  //         </li>

  //         {/* Результаты поиска */}
  //         {searchQuery && (
  //           <ul className="guest-dropdown-menu">
  //             {isSearching ? (
  //               <li className="guest-dropdown-item-wrapper">
  //                 <span className="search-loading">Поиск...</span>
  //               </li>
  //             ) : searchResults.length > 0 ? (
  //               searchResults.map((article) => (
  //                 <li key={article.id} className="guest-dropdown-item-wrapper">
  //                   <Link to={`/article/${article.id}`} className="guest-dropdown-link">
  //                     <FileText size={14} />
  //                     {article.title}
  //                   </Link>
  //                 </li>
  //               ))
  //             ) : (
  //               <li className="guest-dropdown-item-wrapper">
  //                 <span className="no-search-results">Статьи не найдены</span>
  //               </li>
  //             )}
  //           </ul>
  //         )}

  //         {/* Категории — только названия, без статей */}
  //         {!searchQuery && (
  //           <li className={`guest-dropdown ${isCategoriesOpen ? 'guest-active-dropdown' : ''}`}>
  //             <div
  //               className="guest-nav-item guest-dropdown-toggle"
  //               onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
  //               style={{ cursor: 'pointer' }}
  //             >
  //               <a href="/categories" className="guest-nav-item-content">
  //                 <Folder size={16} className="guest-nav-icon" />
  //                 <span>Категории</span>
  //               </a>
  //               {isCategoriesOpen ? (
  //                 <ChevronDown className="guest-dropdown-icon guest-rotate-down" />
  //               ) : (
  //                 <ChevronRight className="guest-dropdown-icon" />
  //               )}
  //             </div>

  //             {/* Меню категорий — только ссылки на категории */}
  //             {isCategoriesOpen && (
  //               <ul className="guest-dropdown-menu">
  //                 {isLoading ? (
  //                   <li className="guest-dropdown-item-wrapper">
  //                     <span className="loading">Загрузка...</span>
  //                   </li>
  //                 ) : error ? (
  //                   <li className="guest-dropdown-item-wrapper">
  //                     <span className="guest-dropdown-link kb-error">Ошибка</span>
  //                   </li>
  //                 ) : (
  //                   sortedCategories.map((category) => ( // ✅ Используем отсортированные категории
  //                     <li key={category.id} className="guest-category-item">
  //                       <Link
  //                         to={`/category/${category.id}`}
  //                         className={`guest-dropdown-link guest-category-header ${isActiveCategory(category.id) ? 'guest-active' : ''}`}
  //                       >
  //                         {category.iconPath ? (
  //                           <img src={category.iconPath} alt={category.description} className="category-icon" />
  //                         ) : (
  //                           <Folder size={14} className="category-icon" />
  //                         )}
  //                         {category.description}
  //                       </Link>
  //                     </li>
  //                   ))
  //                 )}
  //               </ul>
  //             )}
  //           </li>
  //         )}
  //       </ul>
  //     </div>
  //     {isOpen && <div className="sidebar-overlay" onClick={toggleOpen} />}
  //   </>
  // );
};

export default GuestSidebar;