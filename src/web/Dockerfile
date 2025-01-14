# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security updates
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions and security audit
RUN npm ci --production=false && \
    npm audit fix

# Copy source code and configuration files
COPY . .

# Set build environment variables
ENV NODE_ENV=production \
    VITE_APP_ENV=production \
    CI=true

# Build production bundle
RUN npm run build

# Stage 2: Production environment
FROM nginx:1.25-alpine

# Install security updates and create nginx user
RUN apk update && \
    apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/* && \
    adduser -D -H -u 101 -s /sbin/nologin nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 644 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Configure gzip compression
RUN echo "gzip_static on;" > /etc/nginx/conf.d/gzip.conf && \
    echo "gunzip on;" >> /etc/nginx/conf.d/gzip.conf

# Set environment variables
ENV NGINX_PORT=80 \
    TZ=UTC

# Expose port
EXPOSE 80

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Switch to non-root user
USER nginx

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]