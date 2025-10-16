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

  const getTokenPayload = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  };

  const getTokenExpMs = (token) => {
    const payload = getTokenPayload(token);
    return payload?.exp ? payload.exp * 1000 : 0;
  };

  const getTokenIatMs = (token) => {
    const payload = getTokenPayload(token);
    return payload?.iat ? payload.iat * 1000 : 0;
  };

  // Глобальные флаги/таймеры на модуль
  let refreshTimer = null;
  let refreshInProgress = false;

  // Динамическое планирование тихого refresh
  // - опережение = min(10% от TTL, 30s), но не меньше 2s
  // - при очень малом TTL (например, 6s) рефреш ≈ за 0.6s до exp, без бесконечного цикла
  const scheduleRefresh = (set) => {
    const token = Cookies.get('authToken');
    if (!token) return;

    const expMs = getTokenExpMs(token);
    const iatMs = getTokenIatMs(token);
    const now = Date.now();

    if (!expMs || expMs <= now) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => silentRefresh(set), 1000);
      return;
    }

    const ttlMs = iatMs && expMs ? Math.max(1000, expMs - iatMs) : 15 * 60 * 1000;
    const lead = Math.max(2000, Math.min(30000, Math.floor(ttlMs * 0.1)));
    const timeToExp = expMs - now;
    const delay = timeToExp > lead + 1500 ? (timeToExp - lead) : Math.max(1000, Math.floor(timeToExp * 0.8));

    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => silentRefresh(set), delay);
  };

  // Тихий refresh с защитой от параллельных вызовов и перепланированием
  const silentRefresh = async (set) => {
    if (refreshInProgress) return;
    refreshInProgress = true;
    try {
      const resp = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!resp.ok) throw new Error('refresh failed');
      const data = await resp.json();
      const newToken = data?.token;
      if (newToken) {
        Cookies.set('authToken', newToken, { sameSite: 'Lax' });
        set({ token: newToken, isAuthenticated: true });
        scheduleRefresh(set);
      } else {
        Cookies.remove('authToken');
        set({ token: null, isAuthenticated: false });
      }
    } catch {
      Cookies.remove('authToken');
      set({ token: null, isAuthenticated: false });
    } finally {
      refreshInProgress = false;
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

              scheduleRefresh(set);
            } catch (err) {
              console.error('Ошибка при проверке токена:', err);
              get().logout();
            } finally {
              set({ isAuthChecked: true }); // ✅ Проверка завершена
            }
          } else {
            try {
              await silentRefresh(set);
            } catch {
              // ignore
            } finally {
              set({ isAuthChecked: true }); // ✅ Нет токена — всё равно проверка прошла
            }
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

            scheduleRefresh(set);

            return true;
          } catch (error) {
            set({
              error: error.message || 'Ошибка авторизации',
              isLoading: false,
            });
            return false;
          }
        },

        logout: async () => {
          try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
          Cookies.remove('authToken');
          useChatStore.getState().clearChat();
          if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
          refreshInProgress = false;
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
