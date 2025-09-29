// src/api/setupInterceptors.js
import { ApiClient } from './apiClient';
import Cookies from 'js-cookie';

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};

export const setupInterceptors = () => {
  // 🔹 Request interceptor
  ApiClient.interceptors.request.use(
    (config) => {
      const token = Cookies.get('authToken');
      if (token && isTokenExpired(token)) {
        console.log('Token expired before request, removing...');
        Cookies.remove('authToken');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expired'));
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // 🔹 Response interceptor
  ApiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.log('Received 401 error, token likely expired');
        Cookies.remove('authToken');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};