import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useSidebarStore } from '../store/sidebarStore';
import { Menu } from 'lucide-react';
import '../style/Header.css';
import '../style/ThemeToggle.css'; // Новый файл CSS для стилей переключателя

const Header = () => {
  const { isAuthenticated, user, logout, hasRole } = useAuthStore();
  const { toggleChat } = useChatStore();
  const { toggleOpen, setOpen } = useSidebarStore();
  const navigate = useNavigate();

  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme === 'dark' || (savedTheme === 'system' && prefersDark) ? 'dark' : 'light';

    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    document.body.classList.toggle("lightmode", initialTheme === 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.classList.toggle("lightmode", newTheme === 'light');
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setOpen(!isMobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleCreatePost = () => {
    navigate('/create-article');
  };

  const handleAdminPanel = () => {
    navigate('/admin');
  };

  // Новое: переход в «Мои работы»
  const handleMyWork = () => {
    navigate('/my/work');
  };

  const isAdmin = isAuthenticated && hasRole('ADMIN');
  const isWriter = isAuthenticated && hasRole('WRITER');
  const isModerator = isAuthenticated && hasRole('MODERATOR');

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="header-left">
            <button className="hamburger" onClick={toggleOpen}>
              <Menu size={24} />
            </button>

            <Link to="/" className="logo">
              <img
                src={theme === 'dark' ? "/Dark_logo.svg" : "/main_logo.svg"}
                alt="Logo"
                className="logo-header-img"
              />
            </Link>
          </div>

          <div className="header-actions">
            {/* Новый красивый переключатель темы */}
            <div className="theme-toggle-container">
              <input
                type="checkbox"
                id="switch"
                className="darkmode-switch"
                checked={theme === 'light'}
                onChange={toggleTheme}
              />
              <label htmlFor="switch">
                <span className="stars">
                  {[...Array(10)].map((_, i) => <span key={`star-${i}`}></span>)}
                </span>
                <span className="clouds">
                  {[...Array(3)].map((_, i) => <span key={`cloud-${i}`}></span>)}
                </span>
                <span className="dot">
                  <span className="circle"></span>
                  <span className="moon-dot"></span>
                  <span className="sun-rays">
                    {[...Array(4)].map((_, i) => <span key={`ray-${i}`}></span>)}
                  </span>
                </span>
              </label>
            </div>

            {!isAuthenticated ? (
              <button className="btn btn-primary" onClick={handleLogin}>
                Войти
              </button>
            ) : (
              <div className="auth-actions">
                {(isAdmin || isWriter || isModerator) && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleMyWork}
                    style={{ marginRight: '10px' }}
                  >
                    Мои работы
                  </button>
                )}

                {(isAdmin || isWriter) && (
                  <button
                    className="btn btn-primary"
                    onClick={handleCreatePost}
                    style={{ marginRight: '10px' }}
                  >
                    Создать пост
                  </button>
                )}

                {(isAdmin || isModerator) && (
                  <button
                    className="btn btn-primary"
                    onClick={handleAdminPanel}
                    style={{ marginRight: '10px' }}
                  >
                    Админ панель
                  </button>
                )}

                <button
                  className="btn"
                  onClick={toggleChat}
                  style={{ marginRight: '10px' }}
                >
                  Чат
                </button>

                <button className="btn" onClick={handleLogout}>
                  Выйти ({user?.sub || user?.email || 'User'})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
