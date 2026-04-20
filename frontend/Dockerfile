FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# BACKEND_URL is injected at container startup via envsubst (nginx docker entrypoint)
# Set it in Render dashboard: BACKEND_URL=https://your-backend.onrender.com
ENV BACKEND_URL=http://localhost:8000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
