// store/accessRoleStore.js
import { create } from 'zustand';
import { accessRoleAPI } from '../api/apiServese';
import { logAction } from '../api/logClient';

export const useAccessRoleStore = create((set, get) => ({
  accessRoles: [],
  isLoading: false,
  error: null,

  fetchAllAccessRoles: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await accessRoleAPI.getAllAccessRoles();
      set({
        accessRoles: response.data,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка загрузки ролей доступа',
        isLoading: false,
      });
    }
  },

  checkUserHasAccessRole: async (userId, accessRoleTitle) => {
    set({ isLoading: true, error: null });
    try {
      const response = await accessRoleAPI.checkUserHasAccessRole(userId, accessRoleTitle);
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка проверки роли доступа',
        isLoading: false,
      });
      return false;
    }
  },

  createAccessRole: async (accessRoleDto) => {
    set({ isLoading: true, error: null });
    try {
      const response = await accessRoleAPI.createAccessRole(accessRoleDto);
      const { accessRoles } = get();
      set({
        accessRoles: [...accessRoles, response.data],
        isLoading: false,
      });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Ошибка создания роли доступа',
        isLoading: false,
      });
      return false;
    }
  },

  hardDeleteAccessRole: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await accessRoleAPI.hardDeleteAccessRole(id);
      const { accessRoles } = get();
      const updatedRoles = accessRoles.filter((r) => r.id !== id);
      set({
        accessRoles: updatedRoles,
        isLoading: false,
      });
      logAction('INFO', 'ACCESS_ROLE_HARD_DELETED', 'Роль доступа полностью удалена', { roleId: id });
      return true;
    } catch (error) {
      logAction('ERROR', 'ACCESS_ROLE_HARD_DELETE_FAIL', 'Ошибка при полном удалении роли', {
        roleId: id,
        error: error.message,
      });
      set({
        error: error.response?.data?.message || 'Не удалось удалить роль',
        isLoading: false,
      });
      return false;
    }
  },
}));