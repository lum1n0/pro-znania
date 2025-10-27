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
        isBotThinking
    } = useChatStore();
    const { userId, isAuthenticated } = useAuthStore();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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
    }, [messages, isBotThinking]);

    // Отправка сообщения
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

            await sendMessage(messageText);
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
            inputRef.current?.focus();
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
            {/* Заголовок чата */}
            <div className="chat-header">
                <div className="chat-header-content">
                    <div className="chat-avatar">
                        <div className="avatar-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <span className={`status-indicator ${isConnected ? 'connected' : 'connecting'}`}></span>
                    </div>
                    <div className="chat-title-wrapper">
                        {/*<h2 className="chat-title">Розалинда</h2>*/}
                        <span className={`connection-status ${isConnected ? 'connected' : 'connecting'}`}>
              {isConnected ? 'Онлайн' : 'Подключение...'}
            </span>
                    </div>
                </div>
                <button
                    className="chat-close-btn"
                    onClick={handleToggleChat}
                    aria-label="Закрыть чат"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </button>
            </div>

            {/* Область сообщений */}
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <div className="welcome-icon">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 4C12.96 4 4 12.96 4 24C4 35.04 12.96 44 24 44C35.04 44 44 35.04 44 24C44 12.96 35.04 4 24 4ZM24 10C27.32 10 30 12.68 30 16C30 19.32 27.32 22 24 22C20.68 22 18 19.32 18 16C18 12.68 20.68 10 24 10ZM24 38.4C19 38.4 14.58 35.84 12 31.96C12.06 27.98 20 25.8 24 25.8C27.98 25.8 35.94 27.98 36 31.96C33.42 35.84 29 38.4 24 38.4Z" fill="url(#gradient1)"/>
                                <defs>
                                    <linearGradient id="gradient1" x1="4" y1="4" x2="44" y2="44">
                                        <stop stopColor="#667eea" />
                                        <stop offset="1" stopColor="#764ba2" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h3>Добро пожаловать!</h3>
                        <p>Я Розалинда, ваш виртуальный ассистент. Чем могу помочь?</p>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`message-wrapper ${msg.isFromBot ? 'bot' : 'user'}`}
                    >
                        {msg.isFromBot && (
                            <div className="message-avatar bot">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="10" fill="#9ad2d6"/>
                                    <path d="M10 2C5.6 2 2 5.6 2 10C2 14.4 5.6 18 10 18C14.4 18 18 14.4 18 10C18 5.6 14.4 2 10 2ZM10 5C11.38 5 12.5 6.12 12.5 7.5C12.5 8.88 11.38 10 10 10C8.62 10 7.5 8.88 7.5 7.5C7.5 6.12 8.62 5 10 5ZM10 15.8C8.125 15.8 6.4675 14.9 5.5 13.49C5.5225 11.995 8.5 11.175 10 11.175C11.495 11.175 14.4775 11.995 14.5 13.49C13.5325 14.9 11.875 15.8 10 15.8Z" fill="white"/>
                                    <defs>
                                        <linearGradient id="avatarGradient" x1="0" y1="0" x2="20" y2="20">
                                            <stop stopColor="#667eea" />
                                            <stop offset="1" stopColor="#764ba2" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        )}
                        <div className={`message ${msg.isFromBot ? 'bot-message' : 'user-message'}`}>
                            <div className="message-content">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                            <div className="message-time">
                                {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        {!msg.isFromBot && (
                            <div className="message-avatar user">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="10" fill="#9ad2d6"/>
                                    <text x="10" y="14" fontSize="12" fill="white" textAnchor="middle" fontWeight="600">Вы</text>
                                </svg>
                            </div>
                        )}
                    </div>
                ))}

                {/* Индикатор "Розалинда думает" */}
                {isBotThinking && (
                    <div className="message-wrapper bot">
                        <div className="message-avatar bot">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="10" r="10" fill="#9ad2d6"/>
                                <path d="M10 2C5.6 2 2 5.6 2 10C2 14.4 5.6 18 10 18C14.4 18 18 14.4 18 10C18 5.6 14.4 2 10 2ZM10 5C11.38 5 12.5 6.12 12.5 7.5C12.5 8.88 11.38 10 10 10C8.62 10 7.5 8.88 7.5 7.5C7.5 6.12 8.62 5 10 5ZM10 15.8C8.125 15.8 6.4675 14.9 5.5 13.49C5.5225 11.995 8.5 11.175 10 11.175C11.495 11.175 14.4775 11.995 14.5 13.49C13.5325 14.9 11.875 15.8 10 15.8Z" fill="white"/>
                                <defs>
                                    <linearGradient id="avatarGradient2" x1="0" y1="0" x2="20" y2="20">
                                        <stop stopColor="#667eea" />
                                        <stop offset="1" stopColor="#764ba2" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div className="message bot-message thinking">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Поле ввода */}
            <div className="chat-input-wrapper">
                <div className="chat-input">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Введите сообщение..."
                        disabled={!isConnected || isSending}
                        className="chat-input-field"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!isConnected || !input.trim() || isSending}
                        className={`send-button ${isSending ? 'sending' : ''}`}
                        aria-label="Отправить сообщение"
                    >
                        {isSending ? (
                            <svg className="spinner" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="white" strokeLinecap="round"/>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="#9ad2d6" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 10L18 2L10 18L8 11L2 10Z" fill="white"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;