// src/page/NotFoundPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../style/NotFoundPage.css';
import okak from "../assets/1747759868_new_preview_AQAEh48uxtUjWgUqmJ-seFu4XXm_ccsgWQB-EESrlEHnwUomAvUcWF4heDU9hCmlC_3n-KWsr6cUho7IWuicXhQEK7Y.jpg"
const NotFoundPage = () => {
  return (
    <div className="not-found-page">
      {/* Окак заглядывает с правого края */}
      <div className="peeking-okak">
        <img src={okak} alt="Окак" className="okak-image" />
      </div>

      {/* Основной контент */}
      <div className="error-container">
        <div className="error-code">404</div>
        <div className="error-message">
          <h1>Страница не найдена</h1>
          <p>Похоже, вы ушли слишком далеко от базы знаний…</p>
          <p>Котик тоже не знает, куда ведёт эта ссылка 😅</p>
        </div>
        <Link to="/" className="back-home-btn">
          <ArrowLeft size={18} />
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;