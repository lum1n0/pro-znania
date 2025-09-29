// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { userAPI } from '../api/apiServese';
import { useChatStore } from './chatStore';

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Ошибка при декодировании токена:', error);
    return true;
  }
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      userId: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastTokenCheck: null,
      isTokenInvalidated: false,
      isAuthChecked: false, // ✅ Добавлено: флаг проверки

      // Проверяем авторизацию при старте
      checkAuth: async () => {
        const token = Cookies.get('authToken');
        if (token && !isTokenExpired(token)) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            set({ token, isAuthenticated: true, user: payload });

            try {
              const userResponse = await userAPI.getCurrentUserId();
              const userId = userResponse.data.userId || userResponse.data.id || payload.id;
              set({ userId });
              localStorage.setItem('userId', userId);
            } catch (error) {
              if (!payload.roles?.includes('ROLE_ADMIN')) {
                set({ error: 'Не удалось получить ID пользователя' });
              }
            }
          } catch (err) {
            console.error('Ошибка при проверке токена:', err);
            get().logout();
          } finally {
            set({ isAuthChecked: true }); // ✅ Проверка завершена
          }
        } else {
          set({ isAuthChecked: true }); // ✅ Нет токена — всё равно проверка прошла
        }
      },

      validateToken: () => {
        const { token } = get();
        const now = Date.now();

        if (get().lastTokenCheck && now - get().lastTokenCheck < 10000) {
          return !get().isTokenInvalidated;
        }

        let isValid = true;
        if (!token || isTokenExpired(token)) {
          get().logout();
          isValid = false;
        }

        set({
          lastTokenCheck: now,
          isTokenInvalidated: !isValid,
          isAuthChecked: true, // ✅ Убедимся, что проверка пройдена
        });

        return isValid;
      },

      hasRole: (roleName) => {
        const { user, token } = get();
        if (!token || isTokenExpired(token)) return false;
        if (!user) return false;

        const roles = [
          ...(user.roles?.map(r => typeof r === 'string' ? r : r.title || r.name) || []),
          ...(user.accessRoles?.map(r => r.title) || []),
          ...(user.authorities?.map(a => typeof a === 'string' ? a : a.authority) || []),
        ];

        return roles.includes(roleName) || roles.includes(`ROLE_${roleName}`);
      },

      getCurrentUser: () => {
        const { user, token } = get();
        if (!token || isTokenExpired(token)) return null;
        return user;
      },

      getUserId: () => {
        const { userId, token } = get();
        if (!token || isTokenExpired(token)) return null;
        return userId;
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await userAPI.login({ email, password });
          const { token } = response.data;

          if (isTokenExpired(token)) throw new Error('Invalid token');

          Cookies.set('authToken', token, { expires: 7 });
          const payload = JSON.parse(atob(token.split('.')[1]));

          let userId = null;
          try {
            const userResponse = await userAPI.getCurrentUserId();
            userId = userResponse.data.userId || userResponse.data.id;
          } catch (error) {
            if (!payload.roles?.includes('ROLE_ADMIN')) {
              throw new Error('Не удалось получить ID пользователя');
            }
          }

          if (userId) {
            localStorage.setItem('userId', userId);
          } else {
            localStorage.removeItem('userId');
          }

          set({
            user: payload,
            userId,
            token,
            isAuthenticated: true,
            isAuthChecked: true, // ✅ Успешный логин = проверка пройдена
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          set({
            error: error.message || 'Ошибка авторизации',
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        Cookies.remove('authToken');
        useChatStore.getState().clearChat();
        set({
          user: null,
          userId: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isAuthChecked: true, // ✅ После logout тоже считаем, что проверка была
        });
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('chat-storage');
        localStorage.removeItem('userId');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        userId: state.userId,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);