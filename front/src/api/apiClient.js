// src/api/apiClient.js
import axios from 'axios';

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