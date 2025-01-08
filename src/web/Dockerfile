# ===== Stage 1: Build Stage =====
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for node-gyp and other build tools
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --no-audit --no-optional

# Copy source code and configuration files
COPY . .

# Set build environment variables
ENV NODE_ENV=production \
    VITE_APP_ENV=production \
    CI=true

# Build production bundle with optimization flags
RUN npm run build

# ===== Stage 2: Production Stage =====
FROM nginx:1.25-alpine

# Install security updates and create nginx user
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl && \
    adduser -D -H -u 101 -s /sbin/nologin nginx && \
    rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chmod -R 644 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Create health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

# Configure security headers
RUN echo "add_header X-Frame-Options 'DENY' always;" > /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header X-Content-Type-Options 'nosniff' always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header X-XSS-Protection '1; mode=block' always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header Referrer-Policy 'strict-origin-when-cross-origin' always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss: https://api.openai.com;\" always;" >> /etc/nginx/conf.d/security-headers.conf

# Set environment variables
ENV NGINX_PORT=80 \
    TZ=UTC

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]