import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import Header from './component/Header';
import Footer from './component/Footer';
import Sidebar from './component/Sidebar';
import GuestSidebar from './component/GuestSidebar';
import Chat from './component/Chat';
import HomePage from './page/HomePage';
import LoginPage from './page/LoginPage';
import ArticlePage from './page/ArticlePage';
import CreateArticlePage from './page/CreateArticlePage';
import AdminPage from './page/AdminPage';
import UserManagementPage from './page/UserManagementPage';
import CategoryManagementPage from './page/CategoryManagementPage';
import AccessRoleManagementPage from './page/AccessRoleManagementPage';
import EditArticlePage from './page/EditArticlePage';
import FeedbackAdminPage from './page/FeedbackAdminPage';
import LogViewerPage from './page/LogViewerPage';
import AllCategoriesPage from './page/AllCategoryPage';
import { ToastContainer } from 'react-toastify';
import CategoryPage from './page/CategoryPage';
import NotFoundPage from './page/NotFoundPage';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const { isLoading, isAuthenticated, checkAuth, validateToken } = useAuthStore();
  const { isChatOpen } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Проверяем аутентификацию при загрузке приложения
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Проверяем токен при каждом изменении маршрута
    if (isAuthenticated && !validateToken()) {
      console.log('Token validation failed on route change');
      // validateToken уже вызовет logout, который сделает редирект
    }
  }, [location.pathname, isAuthenticated, validateToken]);

  // Периодическая проверка токена каждые 30 секунд
  useEffect(() => {
    let interval;

    if (isAuthenticated) {
      interval = setInterval(() => {
        if (!validateToken()) {
          console.log('Token validation failed on periodic check');
          // validateToken уже вызовет logout
        }
      }, 30000); // Проверяем каждые 30 секунд
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAuthenticated, validateToken]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <Header />
      <div className={`main-container ${isChatOpen ? 'chat-open' : ''}`}>
        {isAuthenticated ? <Sidebar /> : <GuestSidebar />}
        <div className={`content ${isAuthenticated ? 'with-sidebar' : 'with-guest-sidebar'}`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/category/:id" element={<CategoryPage />} />
            <Route path="/categories" element={<AllCategoriesPage />} />
            <Route path="*" element={<NotFoundPage />} />
            
            {isAuthenticated && (
              <>
                <Route path="/create-article" element={<CreateArticlePage />} />
                <Route path="/article/:id/edit" element={<EditArticlePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/categories" element={<CategoryManagementPage />} />
                <Route path="/admin/access-roles" element={<AccessRoleManagementPage />} />
                <Route path="/admin/feedback" element={<FeedbackAdminPage />} />
                <Route path="/admin/logs" element={<LogViewerPage />} />
                

                
              </>
              
            )}
          </Routes>
        </div>
        {isAuthenticated && isChatOpen && <Chat />}
      </div>
      <Footer />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
    </div>
  );
}

export default App;
