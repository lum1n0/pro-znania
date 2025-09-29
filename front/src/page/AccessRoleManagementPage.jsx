// src/pages/AccessRoleManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAccessRoleStore } from '../store/accessRoleStore';
import { Plus } from 'lucide-react';
import { showSuccess, showError } from '../utils/toastUtils';
import '../style/AccessRoleManagementPage.css';
import ConfirmationModal from '../component/ConfirmationModal';

const AccessRoleManagementPage = () => {
  const { hasRole } = useAuthStore();
  const { accessRoles, fetchAllAccessRoles, createAccessRole, hardDeleteAccessRole, isLoading, error } = useAccessRoleStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const hasAccess = hasRole('ADMIN') || hasRole('WRITER');
  const isOwnerOrAdmin = hasRole('ADMIN');

  useEffect(() => {
    if (hasAccess) {
      fetchAllAccessRoles();
    }
  }, [hasAccess]);

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (newRoleTitle.trim()) {
      const success = await createAccessRole({ title: newRoleTitle.trim() });
      if (success) {
        setIsModalOpen(false);
        setNewRoleTitle('');
      }
    }
  };

  const handleHardDelete = (id, title) => {
    if (!isOwnerOrAdmin) {
      showError('Только администратор может удалять роли');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Удалить роль доступа',
      message: `Вы уверены, что хотите удалить роль "${title}"? Это действие нельзя отменить.`,
      onConfirm: async () => {
        const success = await hardDeleteAccessRole(id);
        if (success) {
          showSuccess('Роль удалена');
          fetchAllAccessRoles();
        } else {
          showError('Ошибка при удалении роли');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
    });
  };

  if (!hasAccess) {
    return <Navigate to="/" />;
  }

  return (
    <div className="access-role-management-page">
      <div className="container">
        <div className="page-header">
          <h1>Управление ролями доступа</h1>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Создать роль доступа
          </button>
        </div>

        {isLoading && <p>Загрузка...</p>}
        {error && <p className="alert alert-error">{error}</p>}

        <table className="access-role-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {accessRoles.map((role) => (
              <tr key={role.id}>
                <td>{role.id}</td>
                <td>{role.title}</td>
                <td>
                  {isOwnerOrAdmin && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleHardDelete(role.id, role.title)}
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Модальное окно создания */}
        {isModalOpen && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h2>Создать новую роль доступа</h2>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateRole}>
                <div className="form-group">
                  <label className="form-label">Название роли</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    required
                    placeholder="e.g., FULL_ACCESS"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Создать
                  </button>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Модальное окно подтверждения */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        />
      </div>
    </div>
  );
};

export default AccessRoleManagementPage;