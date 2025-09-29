# Используем образ Node.js для сборки
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json (или yarn.lock)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код приложения
COPY . .

# Собираем приложение для production
RUN npm run build

# Используем Nginx для обслуживания статики
FROM nginx:alpine

# Копируем собранные файлы из этапа сборки
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем кастомный конфиг Nginx (если есть)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80 для доступа к Nginx
EXPOSE 80

# Команда для запуска Nginx (обычно не требуется, т.к. Nginx уже настроен)
CMD ["nginx", "-g", "daemon off;"]