import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import { chatAPI } from '../api/apiServese';
import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';

export const useChatStore = create(
  persist(
    (set, get) => ({
      messages: [],
      sessionId: null,
      userId: null,
      stompClient: null,
      isConnected: false,
      processedMessageIds: new Set(),
      isChatOpen: false,
      greetingSent: false,
      isBotThinking: false, // ✅ Новое состояние для отслеживания "думания"

      initializeChat: (userId) => {
        return new Promise((resolve, reject) => {
          if (!userId) {
            console.error('userId обязателен для инициализации чата');
            return reject(new Error('userId is required'));
          }

          if (get().isConnected && get().userId === userId) {
            return resolve();
          }

          const currentSessionId = `session_${userId}_${Date.now()}`;
          set({ sessionId: currentSessionId, userId: userId });

          if (!get().stompClient || !get().stompClient.connected) {
            const springSocket = new SockJS('http://localhost:8080/chat');
            const newStompClient = Stomp.over(springSocket);
            newStompClient.debug = null;
            
            const authToken = Cookies.get('authToken');
            
            newStompClient.connect(
              {
                'Authorization': `Bearer ${authToken}`,
                'X-Auth-Token': authToken,
                'X-User-Id': userId.toString()
              },
              (frame) => {
                console.log('Успешно подключено к Spring WebSocket:', frame);
                set({ stompClient: newStompClient, isConnected: true });

                newStompClient.subscribe(`/topic/${currentSessionId}`, (message) => {
                  const msg = JSON.parse(message.body);
                  if (get().processedMessageIds.has(msg.id)) return;
                  
                  set((state) => ({
                    messages: [
                      ...state.messages,
                      { text: msg.message, isFromBot: msg.isFromBot, timestamp: new Date(), id: msg.id }
                    ],
                    processedMessageIds: new Set([...state.processedMessageIds, msg.id]),
                    isBotThinking: false // ✅ Скрываем "думает" при получении ответа
                  }));
                });

                if (!get().greetingSent) {
                  newStompClient.send('/app/chat.requestGreeting', {}, JSON.stringify({ sessionId: currentSessionId }));
                  set({ greetingSent: true });
                }

                resolve();
              },
              (error) => {
                console.error('Ошибка подключения к Spring WebSocket:', error);
                set({ isConnected: false, isBotThinking: false }); // ✅ Скрываем "думает" при ошибке
                reject(error);
              }
            );
          } else {
            resolve();
          }
        });
      },

      sendMessage: (message) => {
        const { sessionId, stompClient, userId } = get();
        if (!stompClient || !stompClient.connected || !sessionId || !userId) {
          console.error('Невозможно отправить сообщение: чат не готов.');
          set({ isBotThinking: false }); // ✅ На всякий случай скрываем "думает"
          return;
        }

        // ✅ Показываем "Розалинда думает" перед отправкой
        set({ isBotThinking: true });

        const messagePayload = {
          sessionId, message, userId, id: uuidv4(), isFromBot: false
        };

        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(messagePayload));
        
        set((state) => ({
          messages: [
            ...state.messages,
            { text: message, isFromBot: false, timestamp: new Date(), id: messagePayload.id }
          ],
          processedMessageIds: new Set([...state.processedMessageIds, messagePayload.id])
        }));
      },

      toggleChat: () => {
        set((state) => ({ isChatOpen: !state.isChatOpen }));
      },

      clearChat: async () => {
        const { sessionId, stompClient } = get();
        if (sessionId) {
          try { await chatAPI.deleteSessionMessages(sessionId); } catch (err) { console.error('Не удалось удалить сообщения сессии', err); }
        }
        
        if (stompClient && stompClient.connected) {
          stompClient.disconnect(() => console.log('Отключено от Spring WebSocket'));
        }
        
        set({
          messages: [], isConnected: false, sessionId: null, userId: null, stompClient: null,
          processedMessageIds: new Set(), isChatOpen: false,
          greetingSent: false,
          isBotThinking: false // ✅ Сбрасываем состояние "думания"
        });
        localStorage.removeItem('chat-storage');
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages, sessionId: state.sessionId, userId: state.userId,
        greetingSent: state.greetingSent
      }),
    }
  )
);