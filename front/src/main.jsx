// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Убедитесь, что BrowserRouter импортирован
import App from './App';
import './index.css';
import { setupInterceptors } from './api/setupInterceptors';
import { setupGlobalErrorHandlers } from './api/logClient';
import { useAuthStore } from './store/authStore'; // ← добавлено

setupInterceptors();
setupGlobalErrorHandlers();

// ✅ Запускаем проверку авторизации при старте
useAuthStore.getState().checkAuth();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Добавляем future prop для устранения предупреждений */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
