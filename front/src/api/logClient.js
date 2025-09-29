// src/api/logClient.js
import { logAPI } from './apiServese';
import { useAuthStore } from '../store/authStore';

const getCallerInfo = () => {
  const stack = new Error().stack;
  const lines = stack.split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/at (.+) \((.+)\)/) || line.match(/at (.+)/);
    if (match) {
      const func = match[1].trim();
      const file = match[2] ? match[2].trim() : 'unknown';
      return { func, file };
    }
  }
  return { func: 'unknown', file: 'unknown' };
};

const normalizeError = (err) => {
  if (!err) return null;
  return {
    message: err.message,
    stack: err.stack,
    name: err.name,
    ...(err.code && { code: err.code }),
    ...(err.url && { url: err.url }),
    ...(err.status && { status: err.status }),
  };
};

export const logAction = async (level, action, message, meta = {}) => {
  const { user } = useAuthStore.getState();
  const { func, file } = getCallerInfo();

  if (meta.error) {
    meta.error = normalizeError(meta.error);
  }

  // Улучшаем сообщение, если есть articleTitle
  if (meta.articleTitle) {
    message = `${message}: "${meta.articleTitle}"`;
  }

  const callerInfo = meta.articleId
    ? `${file} → ${func} (статья: ${meta.articleId})`
    : `${file} → ${func}`;

  const logEntry = {
    level,
    action,
    message,
    userId: user?.id || null,
    userEmail: user?.email || user?.sub || 'guest',
    meta: {
      ...meta,
      caller: callerInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
    },
  };

  try {
    await logAPI.createLog(logEntry);
  } catch (err) {
    console.error('[LOG ERROR] Не удалось отправить лог на сервер', err);
  }

  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${action}: ${message}`;
  const details = {
    User: logEntry.userEmail,
    Action: action,
    Level: level,
    Message: message,
    Caller: logEntry.meta.caller,
    Meta: logEntry.meta,
    Timestamp: timestamp,
  };

  const styles = {
    INFO: 'color: #3498db; font-weight: bold;',
    WARN: 'color: #f39c12; font-weight: bold;',
    ERROR: 'color: #e74c3c; font-weight: bold;',
    DEBUG: 'color: #9b59b6; font-weight: bold;',
  };

  console.log(`%c${formattedMessage}`, styles[level] || '', details);

  if (level === 'ERROR' && meta.error?.stack) {
    console.error('Stack trace:', meta.error.stack);
  }
};

export const setupGlobalErrorHandlers = () => {
  window.addEventListener('error', (event) => {
    logAction('ERROR', 'GLOBAL_ERROR', event.error?.message || event.message, {
      error: event.error || { message: event.message, filename: event.filename, lineno: event.lineno },
      eventType: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logAction('ERROR', 'UNHANDLED_PROMISE', 'Unhandled promise rejection', {
      reason: normalizeError(event.reason),
      eventType: 'unhandledrejection',
    });
  });
};

export const logInfo = (action, message, meta) => logAction('INFO', action, message, meta);
export const logWarn = (action, message, meta) => logAction('WARN', action, message, meta);
export const logError = (action, message, meta) => logAction('ERROR', action, message, meta);
export const logDebug = (action, message, meta) => logAction('DEBUG', action, message, meta);