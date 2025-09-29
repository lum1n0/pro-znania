// src/store/categoryStore.js
import { create } from 'zustand';
import { categoryAPI, writerPermissionsAPI, userAPI } from '../api/apiServese'; // Добавлен userAPI
import { logAction } from '../api/logClient';
import { useAuthStore } from './authStore';
import { useAccessRoleStore } from './accessRoleStore';
export const useCategoryStore = create((set, get) => ({
  // Для CategoryManagementPage (с пагинацией)
  categories: [],
  // Для Sidebar (все категории, без пагинации)
  sidebarCategories: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
  // ✅ Новые состояния для вложенных категорий
  categoryTree: [],
  childCategories: {},
  categoryContent: {},

  // Загрузка для управления (с пагинацией)
  fetchAllCategories: async (page = 0, size = 10) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getAllCategories(page, size);
      let categories = [];
      if (response.data.content) {
        categories = response.data.content;
      } else if (Array.isArray(response.data)) {
        categories = response.data;
      } else {
        categories = [];
      }
      set({ categories, isLoading: false });
      return response; // Возвращаем полный ответ для totalPages
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки категорий',
        isLoading: false,
        categories: [],
      });
      return { data: { content: [], totalPages: 0 } };
    }
  },

  // Загрузка для пользователя (с пагинацией)
  fetchCategoriesForUser: async (userId, page = 0, size = 10) => {
    if (!userId) {
      set({ error: 'ID пользователя не определён', isLoading: false });
      return { data: { content: [], totalPages: 0 } };
    }
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getCategoriesForUser(userId, page, size);
      let categories = [];
      if (response.data.content) {
        categories = response.data.content;
      } else if (Array.isArray(response.data)) {
        categories = response.data;
      } else {
        categories = [];
      }
      set({ categories, isLoading: false });
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки категорий',
        isLoading: false,
        categories: [],
      });
      return { data: { content: [], totalPages: 0 } };
    }
  },

  // Загрузка всех категорий для Sidebar (без пагинации, все сразу)
  fetchAllCategoriesForSidebar: async (userId) => {
    if (!userId) {
      set({ error: 'ID пользователя не определён', isLoading: false });
      return { data: [] };
    }
    set({ isLoading: true, error: null });
    try {
      // Запрашиваем максимум 100 категорий (можно увеличить)
      const response = await categoryAPI.getCategoriesForUser(userId, 0, 100);
      let categories = [];
      if (response.data.content) {
        categories = response.data.content;
      } else if (Array.isArray(response.data)) {
        categories = response.data;
      } else {
        categories = [];
      }
      set({ sidebarCategories: categories, isLoading: false });
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки категорий для сайдбара',
        isLoading: false,
      });
      return { data: [] };
    }
  },

  // Гостевые категории
  fetchGuestCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getGuestCategories();
      const categories = Array.isArray(response.data) ? response.data : response.data.content || [];
      const categoriesWithCount = categories.map(category => ({
        ...category,
        articleCount: category.articleCount || category.articles?.length || 0
      }));
      set({ categories: categoriesWithCount, isLoading: false });
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки гостевых категорий',
        isLoading: false,
      });
    }
  },

  // Поиск
  searchCategoriesForUser: async (description, userId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.searchCategoriesForUser(description, userId);
      set({ categories: response.data, isLoading: false });
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка поиска категорий',
        isLoading: false,
        categories: [],
      });
      return { data: [] };
    }
  },

  searchCategoriesForAdmin: async (description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.searchCategoriesForAdmin(description);
      set({ categories: response.data, isLoading: false });
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка поиска категорий',
        isLoading: false,
        categories: [],
      });
      return { data: [] };
    }
  },

  // Создание
  createCategory: async (categoryDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.createCategory(categoryDto);
      const { categories, sidebarCategories } = get();
      set({
        categories: [...categories, response.data],
        sidebarCategories: [...sidebarCategories, response.data],
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка создания категории',
        isLoading: false,
      });
      return false;
    }
  },

  // Обновление
  updateCategory: async (id, categoryDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.updateCategory(id, categoryDto);
      const { categories, sidebarCategories } = get();
      const updatedCategories = categories.map((cat) => (cat.id === id ? response.data : cat));
      const updatedSidebar = sidebarCategories.map((cat) => (cat.id === id ? response.data : cat));
      set({
        categories: updatedCategories,
        sidebarCategories: updatedSidebar,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка обновления категории',
        isLoading: false,
      });
      return false;
    }
  },

  // Удаление
  softDeleteCategory: async (id, isDelete = true) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.softDeleteCategory(id, isDelete);
      const { categories, sidebarCategories } = get();
      const updatedCategories = categories.map((cat) => (cat.id === id ? response.data : cat));
      const updatedSidebar = sidebarCategories.map((cat) => (cat.id === id ? response.data : cat));
      set({
        categories: updatedCategories,
        sidebarCategories: updatedSidebar,
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка удаления категории',
        isLoading: false,
      });
      return false;
    }
  },

  // ИСПРАВЛЕННЫЙ метод fetchCategories
  fetchCategories: async () => {
    const { user } = useAuthStore.getState();

    set({ isLoading: true, error: null });
    try {
      let categories = [];

      if (!user) {
        // Для гостей загружаем гостевые категории
        console.log('Загрузка гостевых категорий для неавторизованного пользователя');
        const response = await categoryAPI.getGuestCategories();
        categories = Array.isArray(response.data) ? response.data : response.data.content || [];
      } else {
        // Проверяем роль пользователя
        const isUserAdmin = user.roles?.includes('ADMIN') || user.roles?.includes('ROLE_ADMIN');
        const isUserWriter = user.roles?.includes('WRITER') || user.roles?.includes('ROLE_WRITER');

        console.log('Загрузка категорий для пользователя:', {
          userId: user.id,
          userEmail: user.sub, // используем email как fallback
          roles: user.roles,
          isAdmin: isUserAdmin,
          isWriter: isUserWriter
        });

        // Для пользователей с JWT токеном получаем userId через правильный API endpoint
        let userId = user.id;
        if (!userId) {
          try {
            // Получаем ID текущего пользователя
            const userResponse = await userAPI.getCurrentUserId();
            userId = userResponse.data.userId || userResponse.data.id;
            console.log('Получен userId:', userId);
          } catch (userError) {
            console.error('Не удалось получить userId:', userError);
          }
        }

        // Если userId все еще не определен, используем гостевые категории
        if (!userId) {
          console.log('userId не определен, загружаю гостевые категории как запасной вариант');
          const response = await categoryAPI.getGuestCategories();
          categories = Array.isArray(response.data) ? response.data : response.data.content || [];
        } else if (isUserAdmin) {
          // Для администратора загружаем все категории
          console.log('Загрузка всех категорий для ADMIN');
          const response = await categoryAPI.getAllCategories(0, 1000);
          if (response.data.content) {
            categories = response.data.content;
          } else if (Array.isArray(response.data)) {
            categories = response.data;
          }
        } else if (isUserWriter) {
          // ДЛЯ WRITER ЗАГРУЖАЕМ ВСЕ КАТЕГОРИИ, К КОТОРЫМ У НЕГО ЕСТЬ ДОСТУП
          console.log('Загрузка всех доступных категорий для WRITER, userId:', userId);
          const response = await categoryAPI.getCategoriesForUser(userId, 0, 1000);
          if (response.data.content) {
            categories = response.data.content;
          } else if (Array.isArray(response.data)) {
            categories = response.data;
          }
        } else {
          // Для других ролей (GUEST, USER и т.д.) загружаем категории по пользователю
          console.log('Загрузка категорий для обычного пользователя, userId:', userId);
          const response = await categoryAPI.getCategoriesForUser(userId, 0, 1000);
          if (response.data.content) {
            categories = response.data.content;
          } else if (Array.isArray(response.data)) {
            categories = response.data;
          }
        }
      }

      console.log('Загружены категории:', categories);
      set({ categories, isLoading: false });
      return { data: categories };
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      set({
        error: error.response?.data?.message || 'Ошибка загрузки категорий',
        isLoading: false,
      });
      return { data: [] };
    }
  },




  // В categoryStore.js
  hardDeleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Проверяем наличие дочерних категорий
      const childCats = useCategoryStore.getState().childCategories[id];
      if (childCats && childCats.length > 0) {
        throw new Error('Невозможно удалить категорию с дочерними категориями');
      }

      // Проверяем наличие статей через API
      const content = await get().fetchCategoryContent(id);
      if (content.articles && content.articles.length > 0) {
        throw new Error('Невозможно удалить категорию с существующими статьями');
      }

      await categoryAPI.hardDeleteCategory(id);
      const { categories, sidebarCategories, selectedCategory } = get();
      const updatedCategories = categories.filter((c) => c.id !== id);
      const updatedSidebar = sidebarCategories.filter((c) => c.id !== id);
      const newSelectedCategory = selectedCategory?.id === id ? null : selectedCategory;
      set({
        categories: updatedCategories,
        sidebarCategories: updatedSidebar,
        selectedCategory: newSelectedCategory,
        isLoading: false,
      });
      logAction('INFO', 'CATEGORY_HARD_DELETED', 'Категория полностью удалена', { categoryId: id });
      return true;
    } catch (error) {
      logAction('ERROR', 'CATEGORY_HARD_DELETE_FAIL', 'Ошибка при полном удалении категории', {
        categoryId: id,
        error: error.message,
      });
      set({
        error: error.message || 'Не удалось удалить категорию',
        isLoading: false,
      });
      return false;
    }
  },

  // ✅ Новые методы для вложенных категорий

  // Перемещение категории
  moveCategory: async (id, parentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.moveCategory(id, parentId);
      // Обновляем категории в сторе
      const { categories, sidebarCategories } = get();
      const updatedCategories = categories.map((cat) => (cat.id === id ? response.data : cat));
      const updatedSidebar = sidebarCategories.map((cat) => (cat.id === id ? response.data : cat));
      set({
        categories: updatedCategories,
        sidebarCategories: updatedSidebar,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка перемещения категории',
        isLoading: false,
      });
      throw error;
    }
  },

  // Получение дочерних категорий
  fetchChildCategories: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getChildCategories(categoryId);
      set((state) => ({
        childCategories: {
          ...state.childCategories,
          [categoryId]: response.data
        },
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки дочерних категорий',
        isLoading: false,
      });
      throw error;
    }
  },

  // Получение статей в категории
  fetchArticlesInCategory: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getArticlesInCategory(categoryId);
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки статей категории',
        isLoading: false,
      });
      throw error;
    }
  },

  // Получение содержимого категории (статьи + подкатегории)
  fetchCategoryContent: async (categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getCategoryContent(categoryId);
      set((state) => ({
        categoryContent: {
          ...state.categoryContent,
          [categoryId]: response.data
        },
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки содержимого категории',
        isLoading: false,
      });
      throw error;
    }
  },

  // Получение дерева категорий
  fetchCategoryTree: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryAPI.getCategoryTree();
      set({ categoryTree: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки дерева категорий',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
  },

  clearError: () => set({ error: null }),

  clearCategories: () => set({
    categories: [],
    sidebarCategories: [],
    categoryTree: [],
    childCategories: {},
    categoryContent: {}
  }),

  // Новый метод для установки категорий напрямую (для использования в CreateArticlePage)
  setCategories: (categories) => {
    set({ categories: Array.isArray(categories) ? categories : [] });
  },
}));