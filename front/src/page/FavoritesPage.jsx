// src/page/FavoritesPage.jsx (новый файл)
import React, { useEffect, useState } from 'react';
import { profileAPI } from '../api/apiServese';
import { Link } from 'react-router-dom';

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await profileAPI.getFavorites();
        if (mounted) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Не удалось загрузить закреплённое:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Загрузка...</div>;

  return (
    <div className="container" style={{ padding: 16 }}>
      <h2>Закреплённые статьи</h2>
      {items.length === 0 ? (
        <div className="card" style={{ padding: 12 }}>Список закреплённых пуст</div>
      ) : (
        <ul className="card" style={{ padding: 12 }}>
          {items.map(f => (
            <li key={f.id}>
              <Link to={`/article/${f.article.id}`}>{f.article.title}</Link>
              <span style={{ marginLeft: 8, color: '#888' }}>
                добавлено: {new Date(f.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
