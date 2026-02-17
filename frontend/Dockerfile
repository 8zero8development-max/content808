FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
ENV PRODUCT_API_URL=http://192.168.1.137:54100
ENV BACKEND_API_URL=http://backend:4000
CMD ["/bin/sh", "-c", "envsubst '${PRODUCT_API_URL} ${BACKEND_API_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
