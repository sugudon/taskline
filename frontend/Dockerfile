# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Runtime stage (non-root nginx, uid 101) ----------
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# Origin of the backend API, allowed in the CSP connect-src. Override at runtime (compose passes it).
ENV API_ORIGIN=http://localhost:8000
# Only substitute API_ORIGIN so nginx's own $variables survive envsubst.
ENV NGINX_ENVSUBST_FILTER=^API_ORIGIN$

# The image entrypoint renders /etc/nginx/templates/**/*.template into /etc/nginx/conf.d/.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY security-headers.conf /etc/nginx/templates/snippets/security-headers.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
