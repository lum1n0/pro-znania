import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { userAPI } from '../api/apiServese';
import { useAccessRoleStore } from '../store/accessRoleStore';
import { writerPermissionsAPI } from '../api/apiServese';
import ConfirmationModal from '../component/ConfirmationModal';
import { showSuccess, showError } from '../utils/toastUtils';
import '../style/UserManagementPage.css';

const UserManagementPage = () => {
  const { hasRole } = useAuthStore();
  const { accessRoles, fetchAllAccessRoles } = useAccessRoleStore();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 0, totalPages: 0, size: 10 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    lastName: '',
    email: '',
    source: '', // '', 'ldap', 'local'
  });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'USER',
    accessRoles: [],
  });
  const [userWriterPermissions, setUserWriterPermissions] = useState({});

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const isAdmin = hasRole('ADMIN');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers(0);
      fetchAllAccessRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, showDeletedUsers, searchFilters]);

  const fetchUsers = async (page) => {
    try {
      const { lastName, email, source } = searchFilters;
      const isFromLdap =
        source === 'ldap' ? true : source === 'local' ? false : undefined;

      // Ключевой момент: передаём isDelete из переключателя
      const response = await userAPI.getUsersWithFilters(
        page,
        pagination.size,
        lastName,
        email,
        isFromLdap,
        showDeletedUsers // ← true = удалённые, false = активные
      );

      if (response?.data?.content !== undefined) {
        setUsers(response.data.content);
        setPagination({
          currentPage: response.data.number,
          totalPages: response.data.totalPages,
          size: response.data.size,
        });
      } else {
        setUsers([]);
        showError('Сервер вернул некорректные данные');
      }
    } catch (error) {
      console.error('Ошибка при загрузке пользователей:', error);
      showError('Ошибка загрузки: ' + (error.response?.data?.message || error.message));
      setUsers([]);
    }
  };

  const fetchUserWriterPermissions = async (userId) => {
    try {
      const response = await writerPermissionsAPI.getWriterPermissions(userId);
      const permissions = response.data || [];
      const permissionsMap = {};
      permissions.forEach(permission => {
        permissionsMap[permission.accessRoleId] = true;
      });
      setUserWriterPermissions(permissionsMap);
    } catch (error) {
      console.error('Ошибка при загрузке writer permissions:', error);
      setUserWriterPermissions({});
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < pagination.totalPages) {
      fetchUsers(newPage);
    }
  };

  const handlePageToggle = (showDeleted) => {
    setShowDeletedUsers(showDeleted);
    setPagination({ currentPage: 0, totalPages: 0, size: 10 });
    setSearchFilters({ lastName: '', email: '', source: '' });
    fetchUsers(0);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAccessRoleChange = (roleId, roleTitle, isChecked) => {
    let updatedAccessRoles = [...formData.accessRoles];
    if (isChecked) {
      updatedAccessRoles.push({ id: roleId, title: roleTitle });
    } else {
      updatedAccessRoles = updatedAccessRoles.filter(role => role.id !== roleId);
    }
    setFormData({ ...formData, accessRoles: updatedAccessRoles });
  };

  const handleWriterPermissionChange = async (roleId, isChecked) => {
    if (!selectedUser) return;

    try {
      if (isChecked) {
        await writerPermissionsAPI.grantWriterPermission(selectedUser.id, roleId);
        showSuccess('Права writer выданы');
      } else {
        await writerPermissionsAPI.revokeWriterPermission(selectedUser.id, roleId);
        showSuccess('Права writer отозваны');
      }

      setUserWriterPermissions(prev => ({
        ...prev,
        [roleId]: isChecked
      }));
    } catch (error) {
      showError('Ошибка при изменении прав writer: ' + (error.response?.data?.message || error.message));
    }
  };

  const isAccessRoleSelected = (roleId) => {
    return formData.accessRoles.some(role => role.id === roleId);
  };

  const isWriterPermissionGranted = (roleId) => {
    return userWriterPermissions[roleId] || false;
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();

    const payload = {
      roleDto: formData.role ? { title: formData.role } : null,
      accessRolesDto: formData.accessRoles.map(role => ({ id: role.id, title: role.title })),
    };

    if (!selectedUser?.isFromLdap) {
      payload.firstName = formData.firstName;
      payload.lastName = formData.lastName;
      payload.email = formData.email.toLowerCase();
      if (formData.password) {
        payload.password = formData.password;
      }
    }

    try {
      if (selectedUser) {
        await userAPI.updateUser(selectedUser.id, payload);
        showSuccess('Пользователь обновлён');
      } else {
        const createPayload = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email.toLowerCase(),
          password: formData.password,
          roleDto: formData.role ? { title: formData.role } : null,
          accessRolesDto: formData.accessRoles.map(role => ({ id: role.id, title: role.title })),
        };
        await userAPI.createUser(createPayload);
        showSuccess('Пользователь создан');
      }
      handleCloseModal();
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка при сохранении';
      showError(message);
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'USER',
      accessRoles: [],
    });
    setUserWriterPermissions({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (user) => {
    setSelectedUser(user);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '',
      role: user.roleDto?.title || 'USER',
      accessRoles: user.accessRolesDto || [],
    });

    await fetchUserWriterPermissions(user.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setUserWriterPermissions({});
    fetchUsers(pagination.currentPage);
  };

  const handleDelete = async (id) => {
    const userToDelete = users.find(u => u.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Подтвердите удаление',
      message: `Вы уверены, что хотите удалить пользователя ${userToDelete.email}?`,
      onConfirm: async () => {
        try {
          await userAPI.updateUser(id, { ...userToDelete, isDelete: true });
          showSuccess('Пользователь удалён');
          fetchUsers(pagination.currentPage);
        } catch (error) {
          showError('Ошибка при удалении');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRestore = async (id) => {
    const userToRestore = users.find(u => u.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Подтвердите восстановление',
      message: `Вы уверены, что хотите восстановить пользователя ${userToRestore.email}?`,
      onConfirm: async () => {
        try {
          await userAPI.restoreUser(id);
          showSuccess('Пользователь восстановлен');
          fetchUsers(pagination.currentPage);
        } catch (error) {
          showError('Ошибка при восстановлении');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSearch = () => {
    setPagination({ ...pagination, currentPage: 0 });
    fetchUsers(0);
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container">
      <div className="user-management-page">
        <h1>Управление пользователями</h1>

        <div className="page-toggle">
          <button
            className={`toggle-btn ${!showDeletedUsers ? 'active' : ''}`}
            onClick={() => handlePageToggle(false)}
          >
            Активные пользователи
          </button>
          <button
            className={`toggle-btn ${showDeletedUsers ? 'active' : ''}`}
            onClick={() => handlePageToggle(true)}
          >
            Удалённые пользователи
          </button>
        </div>

        {!showDeletedUsers && (
          <button className="btn btn-primary create-btn" onClick={handleOpenCreateModal}>
            Создать пользователя
          </button>
        )}

        <div className="search-filters">
          <h3>Фильтры</h3>
          <div className="filter-row">
            <div className="filter-group">
              <label>Фамилия</label>
              <input
                type="text"
                value={searchFilters.lastName}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, lastName: e.target.value })
                }
                placeholder="Введите фамилию"
              />
            </div>
            <div className="filter-group">
              <label>Email</label>
              <input
                type="email"
                value={searchFilters.email}
                onChange={(e) =>
                  setSearchFilters({ ...searchFilters, email: e.target.value })
                }
                placeholder="Введите email"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Источник</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value=""
                  checked={searchFilters.source === ''}
                  onChange={() => setSearchFilters({ ...searchFilters, source: '' })}
                />
                Все
              </label>
              <label>
                <input
                  type="radio"
                  value="ldap"
                  checked={searchFilters.source === 'ldap'}
                  onChange={() => setSearchFilters({ ...searchFilters, source: 'ldap' })}
                />
                LDAP
              </label>
              <label>
                <input
                  type="radio"
                  value="local"
                  checked={searchFilters.source === 'local'}
                  onChange={() => setSearchFilters({ ...searchFilters, source: 'local' })}
                />
                Локально
              </label>
            </div>
          </div>

          <div className="filter-actions">
            <button
              className="btn btn-primary"
              onClick={handleSearch}
            >
              Найти
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearchFilters({ lastName: '', email: '', source: '' });
                handleSearch();
              }}
            >
              Сбросить
            </button>
          </div>
        </div>

        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>Фамилия</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Роли доступа</th>
              <th>Источник</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.firstName}</td>
                  <td>{user.lastName}</td>
                  <td>{user.email}</td>
                  <td>{user.roleDto?.title || 'Не указана'}</td>
                  <td>{user.accessRolesDto?.map(role => role.title).join(', ') || 'Нет'}</td>
                  <td>
                    <span className={`source-badge ${user.isFromLdap ? 'ldap' : 'local'}`}>
                      {user.isFromLdap ? 'LDAP' : 'Локально'}
                    </span>
                  </td>
                  <td>
                    {showDeletedUsers ? (
                      <button
                        className="btn btn-restore"
                        onClick={() => handleRestore(user.id)}
                      >
                        Восстановить
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={user.isFromLdap}
                          title={user.isFromLdap ? 'LDAP-пользователи удаляются через синхронизацию' : ''}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="pagination">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 0}
          >
            Предыдущая
          </button>
          <span>
            Страница {pagination.currentPage + 1} из {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage >= pagination.totalPages - 1}
          >
            Следующая
          </button>
        </div>

        {isModalOpen && (
          <div className="ump-modal-overlay" aria-hidden={!isModalOpen} onClick={handleCloseModal}>
            <div
              className="ump-modal-content"
              role="dialog"
              aria-labelledby="ump-modal-title"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ump-modal-header">
                <h2 id="ump-modal-title">
                  {selectedUser ? 'Редактировать пользователя' : 'Создать пользователя'}
                </h2>
                <button
                  className="ump-modal-close-btn"
                  aria-label="Закрыть модальное окно"
                  onClick={handleCloseModal}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateOrUpdate} className="ump-modal-form">
                <div className="ump-form-row">
                  <div className="ump-form-group">
                    <label htmlFor="ump-firstName">Имя</label>
                    <input
                      type="text"
                      id="ump-firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required={!selectedUser?.isFromLdap}
                      disabled={selectedUser?.isFromLdap}
                    />
                    {selectedUser?.isFromLdap && (
                      <small className="ump-field-hint">
                        Управляется через LDAP
                      </small>
                    )}
                  </div>
                  <div className="ump-form-group">
                    <label htmlFor="ump-lastName">Фамилия</label>
                    <input
                      type="text"
                      id="ump-lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required={!selectedUser?.isFromLdap}
                      disabled={selectedUser?.isFromLdap}
                    />
                    {selectedUser?.isFromLdap && (
                      <small className="ump-field-hint">
                        Управляется через LDAP
                      </small>
                    )}
                  </div>
                </div>

                <div className="ump-form-group">
                  <label htmlFor="ump-email">Email</label>
                  <input
                    type="email"
                    id="ump-email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required={!selectedUser?.isFromLdap}
                    disabled={selectedUser?.isFromLdap}
                  />
                  {selectedUser?.isFromLdap && (
                    <small className="ump-field-hint">
                      Управляется через LDAP
                    </small>
                  )}
                </div>

                <div className="ump-form-group">
                  <label htmlFor="ump-password">Пароль</label>
                  <input
                    type="password"
                    id="ump-password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={selectedUser?.isFromLdap}
                    placeholder={
                      selectedUser?.isFromLdap
                        ? 'Недоступно для LDAP-пользователей'
                        : selectedUser
                          ? 'Оставьте пустым, чтобы не изменять'
                          : ''
                    }
                  />
                  {selectedUser?.isFromLdap && (
                    <small className="ump-password-hint">
                      Пароль управляется через LDAP. Его нельзя изменить здесь.
                    </small>
                  )}
                </div>

                <div className="ump-form-group">
                  <label htmlFor="ump-role">Роль</label>
                  <select
                    id="ump-role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="WRITER">WRITER</option>
                  </select>
                </div>

                <div className="ump-form-group">
                  <label>Роли доступа</label>
                  <div className="ump-access-roles-grid">
                    {accessRoles.length === 0 ? (
                      <span className="ump-no-roles">Нет доступных ролей</span>
                    ) : (
                      accessRoles.map((role) => (
                        <label key={role.id} className="ump-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isAccessRoleSelected(role.id)}
                            onChange={(e) =>
                              handleAccessRoleChange(role.id, role.title, e.target.checked)
                            }
                            disabled={selectedUser?.isFromLdap && role.title === 'LDAP_SYNC'}
                          />
                          <span className="ump-checkbox-custom"></span>
                          {role.title}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {selectedUser && formData.role === 'WRITER' && accessRoles.length > 0 && (
                  <div className="ump-form-group">
                    <label>Права Writer для категорий</label>
                    <div className="ump-writer-permissions-grid">
                      {accessRoles
                        .filter(role => role.title !== 'LDAP_SYNC' && role.title !== 'ADMIN')
                        .map((role) => (
                          <label key={`writer-${role.id}`} className="ump-checkbox-label">
                            <input
                              type="checkbox"
                              checked={isWriterPermissionGranted(role.id)}
                              onChange={(e) =>
                                handleWriterPermissionChange(role.id, e.target.checked)
                              }
                            />
                            <span className="ump-checkbox-custom"></span>
                            {role.title}
                          </label>
                        ))}
                    </div>
                  </div>
                )}

                <div className="ump-form-actions">
                  <button
                    type="button"
                    className="ump-btn ump-btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="ump-btn ump-btn-primary">
                    {selectedUser ? 'Обновить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

export default UserManagementPage;
