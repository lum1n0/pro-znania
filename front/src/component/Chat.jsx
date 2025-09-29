// src/component/Chat.jsx
import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { logAction } from '../api/logClient';
import '../style/Chat.css';

const Chat = () => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const {
    messages,
    sendMessage,
    initializeChat,
    isConnected,
    toggleChat,
    isBotThinking // ✅ Получаем состояние из store
  } = useChatStore();
  const { userId, isAuthenticated } = useAuthStore();
  const messagesEndRef = useRef(null);

  const handleToggleChat = () => {
    toggleChat();
    logAction(
      'INFO',
      'CHAT_TOGGLED',
      'Чат поддержки открыт/закрыт',
      { userId, isOpen: !useChatStore.getState().isChatOpen }
    );
  };

  // Инициализация чата
  useEffect(() => {
    if (isAuthenticated && userId) {
      initializeChat(userId)
        .then(() => {
          logAction(
            'INFO',
            'CHAT_INITIALIZED',
            'Чат успешно инициализирован',
            { userId }
          );
        })
        .catch((error) => {
          logAction(
            'ERROR',
            'CHAT_INIT_FAIL',
            'Ошибка инициализации чата',
            { userId, error: error.message }
          );
        });
    }
  }, [isAuthenticated, userId]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotThinking]); // ✅ Добавляем isBotThinking в зависимости

  // Отправка сообщения с искусственной задержкой
  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const messageText = input.trim();
    setIsSending(true);
    setInput('');

    try {
      logAction(
        'INFO',
        'MESSAGE_SEND_ATTEMPT',
        'Попытка отправки сообщения',
        { userId, message: messageText }
      );

      // Отправляем сообщение
      await sendMessage(messageText);

      // Искусственная задержка 5 секунд
      await new Promise(resolve => setTimeout(resolve, 5000));

      logAction(
        'INFO',
        'MESSAGE_SENT',
        'Сообщение успешно отправлено',
        { userId, message: messageText }
      );
    } catch (error) {
      logAction(
        'ERROR',
        'MESSAGE_SEND_FAIL',
        'Ошибка при отправке сообщения',
        { 
          userId, 
          message: messageText, 
          error: error.message || 'Unknown error',
          stack: error.stack 
        }
      );
      console.error('Ошибка отправки сообщения:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Розалинда</h2>
        <span className={`connection-status ${isConnected ? 'connected' : ''}`}>
          {isConnected ? 'На связи' : 'Подключение...'}
        </span>
        <button className="chat-close-btn" onClick={handleToggleChat}>×</button>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.isFromBot ? 'bot-message' : 'user-message'}`}>
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>
        ))}
        
        {/* ✅ Отображаем "Розалинда думает" */}
        {isBotThinking && (
          <div className="message bot-message thinking-message">
            <ReactMarkdown>Розалинда ищет ответ</ReactMarkdown>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите ваш вопрос..."
          disabled={!isConnected || isSending}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !input.trim() || isSending}
          className={isSending ? 'sending' : ''}
        >
          {isSending ? 'Отправка...' : 'Отправить'}
        </button>
      </div>
    </div>
  );
};

export default Chat;