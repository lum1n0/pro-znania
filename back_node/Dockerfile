# Используем официальный образ Node.js (LTS версия)
FROM node:18-alpine

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код приложения
COPY . .

# Создаем пользователя для безопасности (не root)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Меняем владельца файлов на созданного пользователя
RUN chown -R nodejs:nodejs /app
USER nodejs

# Открываем порт 3001
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"]
