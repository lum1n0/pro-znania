// src/page/ProfilePage.jsx (обновлённый)
import React, { useEffect, useState } from 'react';
import { profileAPI, myWorkAPI, writerPermissionsAPI } from '../api/apiServese';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import "../style/ProfilePage.css";

export default function ProfilePage() {
  const { hasRole } = useAuthStore();
  const [me, setMe] = useState(null);
  const [work, setWork] = useState([]);
  const [editableCategories, setEditableCategories] = useState([]);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingWork, setLoadingWork] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);

  const statusLabel = (s) => {
    switch (s) {
      case 'PENDING': return 'на модерации';
      case 'APPROVED': return 'одобрено';
      case 'REJECTED': return 'отклонено';
      default: return s?.toLowerCase();
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await profileAPI.getMyData();
        if (mounted) setMe(data);
      } catch (e) {
        console.error('Не удалось загрузить профиль:', e);
      } finally { if (mounted) setLoadingMe(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await myWorkAPI.getMyWork();
        if (mounted) setWork(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Не удалось загрузить мои работы:', e);
      } finally { if (mounted) setLoadingWork(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hasRole('WRITER')) return;
    let mounted = true;
    setLoadingPerms(true);
    (async () => {
      try {
        const { data } = await writerPermissionsAPI.getEditableCategories();
        if (mounted) setEditableCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Не удалось загрузить редактируемые категории:', e);
      } finally {
        if (mounted) setLoadingPerms(false);
      }
    })();
    return () => { mounted = false; };
  }, [hasRole]);

  return (
    <div className="container" style={{ padding: 16 }}>
      <h2>Профиль</h2>

      <section style={{ marginTop: 16 }}>
        <h3>Мои данные</h3>
        {loadingMe ? (
          <div>Загрузка...</div>
        ) : me ? (
          <div className="card" style={{ padding: 12 }}>
            <div><strong>Имя:</strong> {me.firstName}</div>
            <div><strong>Фамилия:</strong> {me.lastName}</div>
            <div><strong>Email:</strong> {me.email}</div>
            <div><strong>Роль:</strong> {me.roleDto?.title}</div>
            <div><strong>Доступы:</strong> {(me.accessRolesDto || []).map(r => r.title).join(', ') || '—'}</div>
            <div><strong>LDAP:</strong> {me.isFromLdap ? 'Да' : 'Нет'}</div>
            {hasRole('WRITER') && (
              <div style={{ marginTop: 8 }}>
                <strong>Могу редактировать категории:</strong>
                {loadingPerms ? (
                  <div>Загрузка...</div>
                ) : (
                  <ul style={{ marginTop: 6 }}>
                    {editableCategories.length === 0 ? <li>Нет доступных категорий</li> :
                      editableCategories.map(c => <li className='no-bullet' key={c.id}>{c.description || `Категория #${c.id}`}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 12 }}>Нет данных</div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Мои работы</h3>
        {loadingWork ? (
          <div>Загрузка...</div>
        ) : (
          <>
            {work.length === 0 ? (
              <div className="card" style={{ padding: 12 }}>Пока нет заявок/правок</div>
            ) : (
              <ul className="card" style={{ padding: 12 }}>
                {work.slice(0, 5).map(p => (
                  <li className='no-bullet' key={p.id}>
                   <span className='status'>{statusLabel(p.status)}</span>  {p.title} — категория #{p.categoryId}
                  </li>
                ))}
                <div style={{ marginTop: 8 }}>
              <Link to="/my/work" className='links'>Открыть полный список</Link>
            </div>
              </ul>
              
            )}
            
          </>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Закреплённое</h3>
        <div className="card" style={{ padding: 12 }}>
          <Link to="/favorites" className='links'>Перейти к закреплённым статьям</Link>
        </div>
      </section>
    </div>
  );
}