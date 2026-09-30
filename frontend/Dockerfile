# Stage 1: build the static bundle. Node and node_modules exist only in this
# stage; none of it ships in the final image.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite inlines VITE_* values into the JS at build time, so this is a build
# arg, not a runtime env var. "/api" is the single-origin production value
# (Decision 108): nginx proxies /api to the backend on the same origin.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# Stage 2: serve the built files with nginx.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
