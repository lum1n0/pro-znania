// src/api/apiServese.js
import { ApiClient, LogClient } from './apiClient';

// 🔹 User API
export const userAPI = {
  login: (authRequest) =>
    ApiClient.post('/api/user/login', authRequest, {
      headers: { 'Content-Type': 'application/json' },
    }),

  getAllUsers: (page = 0, size = 10) =>
    ApiClient.get(`/api/user/all?page=${page}&size=${size}`),

  getUserByEmail: (email) =>
    ApiClient.get(`/api/user/${encodeURIComponent(email)}?email=${encodeURIComponent(email)}`),

  getUserById: (id) =>
    ApiClient.get(`/api/user/get-id/${id}`),

  getUserByFirstName: (firstName) =>
    ApiClient.get(`/api/user/${encodeURIComponent(firstName)}?first-name=${encodeURIComponent(firstName)}`),

  getUserByLastName: (lastName) =>
    ApiClient.get(`/api/user/${encodeURIComponent(lastName)}?last-name=${encodeURIComponent(lastName)}`),

  getCurrentUserId: () => ApiClient.get('/api/user/me'),

  createUser: (userDto) => ApiClient.post('/api/user/add', userDto),
  updateUser: (id, userDto) => ApiClient.put(`/api/user/${id}`, userDto),
  restoreUser: (id) => ApiClient.put(`/api/user/${id}/restore`),

  getUsersIsDeleteFalse: (page = 0, size = 10) =>
    ApiClient.get(`/api/user/all/is-delete-false?page=${page}&size=${size}`),

  getUsersIsDeleteTrue: (page = 0, size = 10) =>
    ApiClient.get(`/api/user/all/is-delete-true?page=${page}&size=${size}`),

  // ✅ Фильтрация с поддержкой isFromLdap, lastName, email, isDelete
  getUsersWithFilters: (page, size, lastName, email, isFromLdap, isDelete) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    if (lastName) params.append('lastName', lastName);
    if (email) params.append('email', email);
    if (isFromLdap !== undefined && isFromLdap !== null) params.append('isFromLdap', isFromLdap);
    if (isDelete !== undefined && isDelete !== null) params.append('isDelete', isDelete);
    return ApiClient.get(`/api/user/all/filter?${params.toString()}`);
  },
};

// 🔹 Category API
export const categoryAPI = {
  getGuestCategories: () => ApiClient.get('/api/guest/categories'),

  getAllCategories: (page = 0, size = 10) =>
    ApiClient.get(`/api/category/all?page=${page}&size=${size}`),

  getCategoriesForUser: (userId) =>
    ApiClient.get(`/api/category/${userId}/for-user-all`),

  searchCategoriesForUser: (description, userId) =>
    ApiClient.get(`/api/category/search-by/${userId}?description=${encodeURIComponent(description)}`),

  searchCategoriesForAdmin: (description) =>
    ApiClient.get(`/api/category/search-admin/${description}?description=${description}`),

  createCategory: (categoryDto) => ApiClient.post('/api/category', categoryDto),

  updateCategory: (id, categoryDto) => ApiClient.put(`/api/category/${id}`, categoryDto),

  softDeleteCategory: (id, isDelete = true) =>
    ApiClient.put(`/api/category/${id}/soft-delete?isDelete=${isDelete}`),

  hardDeleteCategory: (id) => ApiClient.delete(`/api/category/delete/${id}`),

  // ✅ Новые эндпоинты для вложенных категорий
  moveCategory: (id, parentId) => {
    const params = new URLSearchParams();
    if (parentId !== null) {
      params.append('parentId', parentId);
    }
    return ApiClient.put(`/api/category/${id}/move${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getChildCategories: (id) => ApiClient.get(`/api/category/${id}/children`),

  getArticlesInCategory: (id) => ApiClient.get(`/api/category/${id}/articles`),

  getCategoryContent: (id) => ApiClient.get(`/api/category/${id}/content`),

  getCategoryTree: () => ApiClient.get('/api/category/tree'),
};

// 🔹 Article API
export const articleAPI = {
  getGuestArticles: (page = 0, size = 10) =>
    ApiClient.get(`/api/guest/articles?page=${page}&size=${size}`),

  getGuestArticlesByCategory: (categoryId) =>
    ApiClient.get(`/api/guest/articles/by-category?categoryId=${categoryId}`),

  searchGuestArticles: (description) =>
    ApiClient.get(`/api/guest/articles/search?description=${description}`),

  getGuestArticleById: (id) =>
    ApiClient.get(`/api/guest/articles/${id}`),

  getAllArticles: (page = 0, size = 10) =>
    ApiClient.get(`/api/articles/all?page=${page}&size=${size}`),

  getArticlesByCategory: (categoryId) =>
    ApiClient.get(`/api/articles/by-category?categoryId=${categoryId}`),

  getAllArticlesByCategoryForAdmin: (categoryId) =>
    ApiClient.get(`/api/articles/admin/by-category?categoryId=${categoryId}`),

  getArticleById: (id) => ApiClient.get(`/api/articles/${id}`),

  searchArticlesForUser: (description, userId) =>
    ApiClient.get(`/api/articles/slidebar/search-by-user?description=${description}&userId=${userId}`),

  searchArticlesForAdmin: (description) =>
    ApiClient.get(`/api/articles/admin/search?description=${description}`),

  createArticle: (formData) => ApiClient.post('/api/articles', formData),

  updateArticle: (id, formData) => ApiClient.put(`/api/articles/${id}`, formData),

  uploadImage: (formData) => ApiClient.post('/api/articles/upload-image', formData),

  softDeleteArticle: (id, isDelete = true) =>
    ApiClient.patch(`/api/articles/${id}/soft-delete?isDelete=${isDelete}`),

  hardDeleteArticle: (id) => ApiClient.delete(`/api/articles/delete/${id}`),

  downloadPdf: (id) => ApiClient.get(`/api/articles/${id}/pdf`, { responseType: 'blob' }),

  // ✅ Просмотры статьи
  getViews: (id) => ApiClient.get(`/api/articles/${id}/views`),
};

// 🔹 article Versions API
export const articleVersionsAPI = {
  // Получение списка версий статьи
  getArticleVersions: (articleId) =>
    ApiClient.get(`/api/articles/${articleId}/versions`),

  // Получение конкретной версии
  getArticleVersion: (articleId, version) =>
    ApiClient.get(`/api/articles/${articleId}/versions/${version}`),

  // Сравнение версии с текущей статьей
  compareArticleVersion: (articleId, fromVersion) =>
    ApiClient.get(`/api/articles/${articleId}/compare?from=${fromVersion}`),

  // Восстановление версии
  restoreArticleVersion: (articleId, version) =>
    ApiClient.post(`/api/articles/${articleId}/versions/${version}/restore`),

  // Удаление версии
  deleteArticleVersion: (articleId, version) =>
    ApiClient.delete(`/api/articles/${articleId}/versions/${version}`),

  // Получение автора конкретной версии
  getArticleVersionAuthor: (articleId, version) =>
    ApiClient.get(`/api/articles/${articleId}/versions/${version}/author`),
};

// 🔹 Access Role API
export const accessRoleAPI = {
  getAllAccessRoles: () => ApiClient.get('/api/access-role/all'),

  getAccessRoleByTitle: (title) =>
    ApiClient.get(`/api/access-role?title=${title}`),

  createAccessRole: (accessRoleDto) =>
    ApiClient.post('/api/access-role', accessRoleDto),

  checkUserHasAccessRole: (userId, accessRoleTitle) =>
    ApiClient.get(`/api/access-role/full/user-has-access?userId=${userId}&accessRoleTitle=${accessRoleTitle}`),

  hardDeleteAccessRole: (id) => ApiClient.delete(`/api/access-role/delete/${id}`),
};

export const writerPermissionsAPI = {
  grantWriterPermission: (writerId, accessRoleId) => {
    const params = new URLSearchParams();
    params.append('writerId', writerId);
    params.append('accessRoleId', accessRoleId);
    return ApiClient.post(`/api/writer-permissions/grant?${params.toString()}`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  },

  revokeWriterPermission: (writerId, accessRoleId) =>
    ApiClient.delete('/api/writer-permissions/revoke', {
      params: { writerId, accessRoleId }
    }),

  getWriterPermissions: (userId) =>
    ApiClient.get(`/api/writer-permissions/by-writer/${userId}`),

  canEditArticle: (categoryId) =>
    ApiClient.get(`/api/writer-permissions/me/can-edit?categoryId=${categoryId}`),

  // Новый эндпоинт для получения всех доступных категорий
  getEditableCategories: () =>
    ApiClient.get('/api/writer-permissions/me/categories-editable'),
};

// 🔹 Feedback API
export const feedbackAPI = {
  createFeedback: (feedbackDto) =>
    ApiClient.post('/api/feedback', feedbackDto, {
      headers: { 'Content-Type': 'application/json' },
    }),

  getAllFeedback: (page = 0, size = 10) =>
    ApiClient.get(`/api/feedback/all?page=${page}&size=${size}`),

  updateFeedbackStatus: (id, isAnswered) =>
    ApiClient.put(`/api/feedback/${id}/answer?isAnswered=${isAnswered}`),
};

// 🔹 Chat API
export const chatAPI = {
  deleteSessionMessages: (sessionId) => ApiClient.delete(`/api/chat/session/${sessionId}`),

  getCurrentSession: () => {
    const token = document?.cookie?.split('; ').find(x => x.startsWith('authToken='))?.split('=')[1];
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return ApiClient.get(`/api/chat/session/current`, { headers });
  },
};

// 🔹 Log API
export const logAPI = {
  createLog: async (logEntry) => {
    try {
      const response = await LogClient.post('/api/logs', logEntry);
      return response.data;
    } catch (error) {
      console.error('[logAPI] Ошибка при отправке лога:', error);
      throw error;
    }
  },
};

// 🔹 Moderation & Submissions API
export const moderationAPI = {
  // Подача заявок WRITER
  submitCreate: (formData) => ApiClient.post('/api/moderation/submit/create', formData),
  submitUpdate: (articleId, formData) => ApiClient.post(`/api/moderation/submit/update/${articleId}`, formData),

  // Очередь модерации (ADMIN/MODERATOR)
  listPending: () => ApiClient.get('/api/moderation/pending'),
  getProposal: (id) => ApiClient.get(`/api/moderation/proposals/${id}`),
  approve: (id, comment) => {
    const fd = new FormData();
    if (comment) fd.append('comment', comment);
    return ApiClient.post(`/api/moderation/proposals/${id}/approve`, fd);
  },
  reject: (id, reason) => {
    const fd = new FormData();
    fd.append('reason', reason);
    return ApiClient.post(`/api/moderation/proposals/${id}/reject`, fd);
  },
};

// 🔹 My Work API
export const myWorkAPI = {
  getMyWork: () => ApiClient.get('/api/my/work'),
};

//my profile
export const profileAPI = {
  getMyData: () => ApiClient.get('/api/profile/my-date'),
  getFavorites: () => ApiClient.get('/api/profile/favorites'),
  addFavorite: (articleId) => ApiClient.post(`/api/profile/favorites/${articleId}`),
  removeFavorite: (articleId) => ApiClient.delete(`/api/profile/favorites/${articleId}`),
};

// 🔹 Notifications API
export const notificationsAPI = {
  // Получить все уведомления (пагинация + сортировка)
  getAll: (page = 0, size = 20, sort = 'createdAt,desc') =>
    ApiClient.get(`/api/notifications?page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`),

  // Получить непрочитанные уведомления
  getUnread: () => ApiClient.get('/api/notifications/unread'),

  // Получить статистику (все/непрочитанные для текущего пользователя)
  getStats: () => ApiClient.get('/api/notifications/stats'),

  // Отметить конкретное уведомление как прочитанное
  markAsRead: (id) => ApiClient.put(`/api/notifications/${id}/read`),

  // Отметить все уведомления пользователя как прочитанные
  markAllAsRead: () => ApiClient.put('/api/notifications/read-all'),

  // Удалить уведомление
  remove: (id) => ApiClient.delete(`/api/notifications/${id}`),

  // Отправить ручную рассылку (ADMIN/MODERATOR)
  // payload соответствует серверному CustomNotificationRequest:
  // { title, message, recipientType: 'SPECIFIC_USERS'|'BY_ROLE'|'BY_ACCESS_ROLE', recipientIds?, roleId?, accessRoleId? }
  send: (payload) =>
    ApiClient.post('/api/notifications/send', payload, {
      headers: { 'Content-Type': 'application/json' },
    }),

  // Удобные хелперы
  sendToUsers: (title, message, recipientIds) =>
    ApiClient.post('/api/notifications/send', {
      title,
      message,
      recipientType: 'SPECIFIC_USERS',
      recipientIds,
    }, { headers: { 'Content-Type': 'application/json' } }),

  sendToRole: (title, message, roleId) =>
    ApiClient.post('/api/notifications/send', {
      title,
      message,
      recipientType: 'BY_ROLE',
      roleId,
    }, { headers: { 'Content-Type': 'application/json' } }),

  sendToAccessRole: (title, message, accessRoleId) =>
    ApiClient.post('/api/notifications/send', {
      title,
      message,
      recipientType: 'BY_ACCESS_ROLE',
      accessRoleId,
    }, { headers: { 'Content-Type': 'application/json' } }),
};
