// src/store/notificationStore.js
import { create } from 'zustand';
import { notificationsAPI, userAPI, accessRoleAPI } from '../api/apiServese';
import { logAction } from '../api/logClient';

export const useNotificationStore = create((set, get) => ({
    notifications: [],
    users: [],
    accessRoles: [],
    isLoading: false,
    error: null,
    unreadCount: 0,



    fetchNotifications: async () => {
        set({ isLoading: true });
        try {
            const response = await notificationsAPI.getAll(0, 20, 'createdAt,desc');
            set({
                notifications: response.data.content || response.data || [],
                isLoading: false,
            });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    fetchUnreadCount: async () => {
        try {
            const response = await notificationsAPI.getStats();
            set({ unreadCount: response.data.unread || 0 });
        } catch {
            set({ unreadCount: 0 });
        }
    },

    markAsRead: async (id) => {
        await notificationsAPI.markAsRead(id);
        get().fetchNotifications();
        get().fetchUnreadCount();
    },

    markAllAsRead: async () => {
        await notificationsAPI.markAllAsRead();
        get().fetchNotifications();
        get().fetchUnreadCount();
    },

    // Загрузка всех пользователей
    fetchAllUsers: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await userAPI.getAllUsers(0, 1000);
            const users = response.data.content || response.data || [];
            set({ users, isLoading: false });
            return users;
        } catch (error) {
            set({
                error: error.response?.data?.message || 'Ошибка загрузки пользователей',
                isLoading: false,
            });
            return [];
        }
    },

    // Загрузка всех ролей доступа
    fetchAllAccessRoles: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await accessRoleAPI.getAllAccessRoles();
            set({ accessRoles: response.data, isLoading: false });
            return response.data;
        } catch (error) {
            set({
                error: error.response?.data?.message || 'Ошибка загрузки ролей доступа',
                isLoading: false,
            });
            return [];
        }
    },

    // Отправка уведомления конкретным пользователям
    sendToUsers: async (title, message, recipientIds) => {
        set({ isLoading: true, error: null });
        try {
            const response = await notificationsAPI.sendToUsers(title, message, recipientIds);
            logAction('INFO', 'NOTIFICATION_SENT_TO_USERS', 'Уведомление отправлено пользователям', {
                title,
                recipientCount: recipientIds.length,
            });
            set({ isLoading: false });
            return response.data;
        } catch (error) {
            logAction('ERROR', 'NOTIFICATION_SEND_FAIL', 'Ошибка отправки уведомления', {
                error: error.message,
            });
            set({
                error: error.response?.data?.message || 'Ошибка отправки уведомления',
                isLoading: false,
            });
            throw error;
        }
    },

    // Отправка уведомления по роли доступа
    sendToAccessRole: async (title, message, accessRoleId) => {
        set({ isLoading: true, error: null });
        try {
            const response = await notificationsAPI.sendToAccessRole(title, message, accessRoleId);
            logAction('INFO', 'NOTIFICATION_SENT_TO_ROLE', 'Уведомление отправлено по роли', {
                title,
                accessRoleId,
            });
            set({ isLoading: false });
            return response.data;
        } catch (error) {
            logAction('ERROR', 'NOTIFICATION_SEND_FAIL', 'Ошибка отправки уведомления', {
                error: error.message,
            });
            set({
                error: error.response?.data?.message || 'Ошибка отправки уведомления',
                isLoading: false,
            });
            throw error;
        }
    },

    // Универсальная отправка уведомления
    sendNotification: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const response = await notificationsAPI.send(payload);
            logAction('INFO', 'NOTIFICATION_SENT', 'Уведомление отправлено', {
                recipientType: payload.recipientType,
            });
            set({ isLoading: false });
            return response.data;
        } catch (error) {
            logAction('ERROR', 'NOTIFICATION_SEND_FAIL', 'Ошибка отправки уведомления', {
                error: error.message,
            });
            set({
                error: error.response?.data?.message || 'Ошибка отправки уведомления',
                isLoading: false,
            });
            throw error;
        }
    },

    clearError: () => set({ error: null }),
}));
