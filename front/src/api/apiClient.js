import axios from "axios";



export const ApiClient = axios.create({
  baseURL: 'http://localhost:8080', // ← напрямую на Kotlin
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 🔹 Логи — Node.js
export const LogClient = axios.create({
  baseURL: 'http://localhost:3001', // ← Node.js собирает логи
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // обычно не нужно
});
// Удаляем заголовок Content-Type для multipart/form-data запросов
// Axios автоматически установит правильный заголовок с boundary
ApiClient.interceptors.request.use(
    (config) => {
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


