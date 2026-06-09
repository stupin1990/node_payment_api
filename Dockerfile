# Используем актуальную версию Node.js на Alpine Linux
FROM node:26-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

RUN npm install --save-dev nodemon

# Копируем остальной исходный код
COPY . .

# Открываем порт приложения
EXPOSE 3000

# Запуск приложения (для дева обычно используют nodemon)
CMD ["npm", "run", "dev"]