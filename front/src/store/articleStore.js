// src/store/articleStore.js
import { create } from 'zustand';
import { articleAPI } from '../api/apiServese';
import { articleVersionsAPI } from '../api/apiServese'; // Убедитесь, что импортирован
import { logAction } from '../api/logClient';

export const useArticleStore = create((set, get) => ({
  articles: [],
  articlesByCategory: {},
  searchArticles: [],
  selectedArticle: null,
  isLoading: false,
  error: null,
  selectedVersionAuthorEmail: null,
  pagination: {
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    size: 10,
  },

  // 🔹 Версии статей
  articleVersions: [],
  selectedVersion: null,
  compareResult: null,

  fetchGuestArticles: async (page = 0, size = 10) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getGuestArticles(page, size);
      const articlesWithUnifiedStructure = response.data.content.map((article) => ({
        ...article,
        categoryId: article.categoryId || article.category?.id || article.categoryDto?.id,
        categoryDto: article.categoryDto || { id: article.categoryId || article.category?.id },
      }));
      set({
        articles: articlesWithUnifiedStructure,
        pagination: {
          currentPage: response.data.number,
          totalPages: response.data.totalPages,
          totalElements: response.data.totalElements,
          size: response.data.size,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте настройки сервера или авторизуйтесь'
            : error.response?.data?.message || 'Ошибка загрузки статей',
        isLoading: false,
      });
    }
  },

  fetchGuestArticlesByCategory: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getGuestArticlesByCategory(categoryId);
      const articlesWithCategory = response.data.map((article) => ({
        ...article,
        categoryDto: { ...article.categoryDto, id: Number(categoryId) },
      }));
      set((state) => ({
        articlesByCategory: {
          ...state.articlesByCategory,
          [categoryId]: articlesWithCategory,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки статей',
        isLoading: false,
      });
    }
  },

  clearArticlesByCategory: (categoryId) => {
    set((state) => {
      const newArticles = { ...state.articlesByCategory };
      delete newArticles[categoryId];
      return { articlesByCategory: newArticles };
    });
  },

  searchGuestArticles: async (description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.searchGuestArticles(description);
      const articles = response.data;
      set({
        searchArticles: articles,
        isLoading: false,
      });
      return { data: articles };
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте настройки поиска'
            : error.response?.data?.message || 'Ошибка поиска статей',
        isLoading: false,
      });
      return { data: [] };
    }
  },

  fetchGuestArticleById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getGuestArticleById(id);
      set({ selectedArticle: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ к статье запрещён'
            : error.response?.data?.message || 'Статья не найдена или доступ запрещен',
        isLoading: false,
        selectedArticle: null,
      });
      return null;
    }
  },

  fetchArticlesByCategory: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getArticlesByCategory(categoryId);
      const articlesWithCategory = response.data.map((article) => ({
        ...article,
        categoryId: Number(categoryId),
        categoryDto: { id: Number(categoryId) },
      }));
      const { articles } = get();
      const otherArticles = articles.filter((article) => {
        const articleCategoryId = article.categoryDto?.id || article.categoryId || article.category?.id;
        return articleCategoryId && Number(articleCategoryId) !== Number(categoryId);
      });
      const newArticles = [...otherArticles, ...articlesWithCategory];
      set({ articles: newArticles, isLoading: false });
      return articlesWithCategory;
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права доступа'
            : error.response?.data?.message || 'Ошибка загрузки статей',
        isLoading: false,
      });
      return [];
    }
  },

  fetchAllArticlesByCategoryForAdmin: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getAllArticlesByCategoryForAdmin(categoryId);
      const articlesWithCategory = response.data.map((article) => ({
        ...article,
        categoryDto: { id: Number(categoryId) },
      }));
      const { articles } = get();
      const otherArticles = articles.filter((article) => {
        const articleCategoryId = article.categoryDto?.id || article.categoryId || article.category?.id;
        return articleCategoryId && Number(articleCategoryId) !== Number(categoryId);
      });
      const newArticles = [...otherArticles, ...articlesWithCategory];
      set({ articles: newArticles, isLoading: false });
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права администратора'
            : error.response?.data?.message || 'Ошибка загрузки статей',
        isLoading: false,
      });
    }
  },

  fetchArticleById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getArticleById(id);
      const article = response.data;

      if (article.categoryDto) {
        article.category = { ...article.categoryDto };
      }

      if (article.category && article.category.id === 0) {
        article.category = null;
      }

      set({ selectedArticle: article, isLoading: false });
      return article;
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ к статье запрещён'
            : error.response?.data?.message || 'Статья не найдена или доступ запрещен',
        isLoading: false,
        selectedArticle: null,
      });
      return null;
    }
  },

  fetchAllArticles: async (page = 0, size = 10) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.getAllArticles(page, size);
      const articlesWithUnifiedStructure = response.data.content.map((article) => ({
        ...article,
        categoryId: article.categoryId || article.category?.id || article.categoryDto?.id,
        categoryDto: article.categoryDto || { id: article.categoryId || article.category?.id },
      }));
      set({
        articles: articlesWithUnifiedStructure,
        pagination: {
          currentPage: response.data.number,
          totalPages: response.data.totalPages,
          totalElements: response.data.totalElements,
          size: response.data.size,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права доступа'
            : error.response?.data?.message || 'Ошибка загрузки статей',
        isLoading: false,
      });
    }
  },

  searchArticlesForUser: async (description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.searchArticlesForUser(description);
      const articlesWithUnifiedStructure = response.data.map((article) => ({
        ...article,
        categoryId: article.categoryId || article.category?.id || article.categoryDto?.id,
        categoryDto: article.categoryDto || { id: article.categoryId || article.category?.id },
      }));
      set({ searchArticles: articlesWithUnifiedStructure, isLoading: false });
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права пользователя'
            : error.response?.data?.message || 'Ошибка поиска статей',
        isLoading: false,
      });
    }
  },

  searchArticlesForAdmin: async (description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.searchArticlesForAdmin(description);
      const articlesWithUnifiedStructure = response.data.map((article) => ({
        ...article,
        categoryId: article.categoryId || article.category?.id || article.categoryDto?.id,
        categoryDto: article.categoryDto || { id: article.categoryId || article.category?.id },
      }));
      set({ searchArticles: articlesWithUnifiedStructure, isLoading: false });
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права администратора'
            : error.response?.data?.message || 'Ошибка поиска статей',
        isLoading: false,
      });
    }
  },

  createArticle: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.createArticle(formData);
      const { articles } = get();
      set({
        articles: [...articles, response.data],
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка создания статьи:', error);
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права для создания статьи'
            : error.response?.data?.message || 'Ошибка создания статьи',
        isLoading: false,
      });
      return null;
    }
  },

  updateArticle: async (id, formData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.updateArticle(id, formData);
      const { articles } = get();
      const updatedArticles = articles.map((article) =>
        article.id === Number(id) ? response.data : article
      );
      set({
        articles: updatedArticles,
        selectedArticle: get().selectedArticle?.id === Number(id) ? response.data : get().selectedArticle,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка обновления статьи:', error);
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права для обновления статьи'
            : error.response?.data?.message || 'Ошибка обновления статьи',
        isLoading: false,
      });
      return null;
    }
  },

  softDeleteArticle: async (id, isDelete = true) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.softDeleteArticle(id, isDelete);
      const { articles } = get();
      const updatedArticles = articles.map((article) =>
        article.id === id ? response.data : article
      );
      set({
        articles: updatedArticles,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права для удаления статьи'
            : error.response?.data?.message || 'Ошибка удаления статьи',
        isLoading: false,
      });
      return false;
    }
  },

  hardDeleteArticle: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await articleAPI.hardDeleteArticle(id);
      const { articles, articlesByCategory, searchArticles, selectedArticle } = get();

      const updatedArticles = articles.filter((a) => a.id !== id);
      const updatedArticlesByCategory = { ...articlesByCategory };
      Object.keys(updatedArticlesByCategory).forEach((key) => {
        updatedArticlesByCategory[key] = updatedArticlesByCategory[key].filter((a) => a.id !== id);
      });
      const updatedSearch = searchArticles.filter((a) => a.id !== id);
      const newSelectedArticle = selectedArticle?.id === id ? null : selectedArticle;

      set({
        articles: updatedArticles,
        articlesByCategory: updatedArticlesByCategory,
        searchArticles: updatedSearch,
        selectedArticle: newSelectedArticle,
        isLoading: false,
      });

      logAction('INFO', 'ARTICLE_HARD_DELETED', 'Статья полностью удалена', { articleId: id });
      return true;
    } catch (error) {
      logAction('ERROR', 'ARTICLE_HARD_DELETE_FAIL', 'Ошибка при полном удалении статьи', {
        articleId: id,
        error: error.message,
      });
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права администратора'
            : error.response?.data?.message || 'Не удалось удалить статью',
        isLoading: false,
      });
      return false;
    }
  },

  downloadArticlePdf: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleAPI.downloadPdf(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'article.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
          filename = decodeURIComponent(filename);
        }
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      set({ isLoading: false });
      return true;
    } catch (error) {
      console.error('Ошибка скачивания PDF:', error);
      set({
        error:
          error.response?.status === 403
            ? 'Доступ запрещён: проверьте права для скачивания PDF'
            : error.response?.data?.message || 'Ошибка скачивания PDF',
        isLoading: false,
      });
      return false;
    }
  },

  fetchArticleVersions: async (articleId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleVersionsAPI.getArticleVersions(articleId);
      console.log("Полученные версии статьи:", response.data); // Для отладки
      // Сортируем по убыванию номера версии
      const sortedVersions = response.data?.sort((a, b) => b.version - a.version) || [];
      set({ 
        articleVersions: sortedVersions,
        isLoading: false 
      });
      return sortedVersions;
    } catch (error) {
      console.error("Ошибка загрузки версий статьи:", error); // Для отладки
      set({
        error: error.response?.data?.message || error.message || 'Ошибка загрузки версий статьи',
        isLoading: false,
        articleVersions: []
      });
      return [];
    }
  },

fetchArticleVersion: async (articleId, version) => {
  set({ isLoading: true, error: null });
  try {
    const response = await articleVersionsAPI.getArticleVersion(articleId, version);
    set({
      selectedVersion: response.data,
      selectedVersionAuthorEmail: response.data?.editedByEmail || null,
      isLoading: false
    });
    return response.data;
  } catch (error) {
    set({
      error: error.response?.data?.message || error.message || 'Ошибка загрузки версии статьи',
      isLoading: false,
      selectedVersion: null,
      selectedVersionAuthorEmail: null
    });
    return null;
  }
},

fetchArticleVersionAuthor: async (articleId, version) => {
  try {
    const response = await articleVersionsAPI.getArticleVersionAuthor(articleId, version);
    set({ selectedVersionAuthorEmail: response.data?.email || null });
    return response.data;
  } catch (error) {
    set({ selectedVersionAuthorEmail: null });
    return null;
  }
},

  // --- УЛУЧШЕННЫЙ Метод для сравнения версий ---
  compareArticleVersion: async (articleId, fromVersion) => {
    console.log("store: compareArticleVersion вызвана с аргументами:", { articleId, fromVersion });
    set({ isLoading: true, error: null });
    try {
      console.log(`store: Вызов articleVersionsAPI.compareArticleVersion(${articleId}, ${fromVersion})`);
      const response = await articleVersionsAPI.compareArticleVersion(articleId, fromVersion);
      console.log("store: Результат сравнения версий от API:", response.data);
      set({ 
        compareResult: response.data,
        isLoading: false 
      });
      return response.data;
    } catch (error) {
      console.error("store: Ошибка API сравнения версий:", error);
      console.error("store: Ошибка API сравнения версий (детали):", error.response);
      set({
        error: error.response?.data?.message || error.message || 'Ошибка сравнения версий статьи на сервере',
        isLoading: false,
        compareResult: null
      });
      throw error; // Пробрасываем ошибку
    }
  },

  restoreArticleVersion: async (articleId, version) => {
    set({ isLoading: true, error: null });
    try {
      const response = await articleVersionsAPI.restoreArticleVersion(articleId, version);
      const { fetchArticleById } = get();
      await fetchArticleById(articleId);
      await get().fetchArticleVersions(articleId);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || error.message || 'Ошибка восстановления версии статьи',
        isLoading: false
      });
      return null;
    }
  },

  // --- ДОБАВЛЕННЫЙ МЕТОД ---
  deleteArticleVersion: async (articleId, version) => {
    set({ isLoading: true, error: null });
    try {
      // Вызываем API для удаления версии
      await articleVersionsAPI.deleteArticleVersion(articleId, version);
      // После успешного удаления, обновляем список версий в store
      const { fetchArticleVersions } = get();
      await fetchArticleVersions(articleId); // Перезагружаем список версий
      set({ isLoading: false });
      return true; // Успешно
    } catch (error) {
      set({
        error: error.response?.data?.message || error.message || 'Ошибка удаления версии статьи',
        isLoading: false
      });
      return false; // Ошибка
    }
  },
  // --- КОНЕЦ ДОБАВЛЕНИЯ ---

  clearArticleVersions: () => {
    set({ 
      articleVersions: [],
      selectedVersion: null,
      compareResult: null 
    });
  },

  setSelectedArticle: (article) => {
    set({ selectedArticle: article });
  },

  clearArticles: () => {
    set({ articles: [] });
  },

  clearError: () => set({ error: null }),
}));