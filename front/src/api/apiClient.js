// src/api/apiClient.js
import axios from 'axios';
import Cookies from 'js-cookie';

// В production используем относительные пути, в development - имена сервисов Docker
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const LOGGER_BASE_URL = process.env.NODE_ENV === 'production' ? '/logger' : 'http://localhost:3001';

export const ApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const LogClient = axios.create({
  baseURL: LOGGER_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

ApiClient.interceptors.request.use(
  (config) => {
    // Добавляем Bearer из cookie
    const token = Cookies.get('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Для FormData позволяем браузеру выставить boundary
    if (config?.data instanceof FormData) {
      if (config.headers && typeof config.headers === 'object') {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ===== 401 → /api/auth/refresh с очередью, чтобы не спамить сервер =====
let isRefreshing = false;
let subscribers = [];

const subscribeTokenRefresh = (cb) => subscribers.push(cb);
const onRefreshed = (token) => {
  subscribers.forEach((cb) => cb(token));
  subscribers = [];
};

ApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!error.response) return Promise.reject(error);

    if (error.response.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (!newToken) return reject(error);
            original.headers = original.headers || {};
            original.headers['Authorization'] = `Bearer ${newToken}`;
            resolve(ApiClient(original));
          });
        });
      }

      isRefreshing = true;
      try {
        // Сервер возьмёт refresh из HttpOnly cookie
        const resp = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = resp?.data?.token;
        if (!newToken) throw new Error('No token in refresh response');

        // Обновляем cookie и дефолтные заголовки
        Cookies.set('authToken', newToken, { sameSite: 'Lax' });
        ApiClient.defaults.headers['Authorization'] = `Bearer ${newToken}`;
        onRefreshed(newToken);

        // Повтор исходного запроса
        original.headers = original.headers || {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return ApiClient(original);
      } catch (e) {
        onRefreshed(null);
        Cookies.remove('authToken');
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
