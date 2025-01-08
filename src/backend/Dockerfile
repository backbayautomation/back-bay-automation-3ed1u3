# Builder stage
FROM python:3.11-slim AS builder

# Install system build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
ENV POETRY_VERSION=1.5.1
ENV POETRY_HOME=/opt/poetry
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Configure Poetry
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Set working directory
WORKDIR /app

# Copy dependency files
COPY --chown=root:root pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root \
    && rm -rf /tmp/poetry_cache

# Copy application code
COPY --chown=root:root app ./app

# Generate optimized bytecode
RUN python -m compileall ./app

# Runtime stage
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04

# Install Python and required system libraries
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-distutils \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set up application directories
RUN mkdir -p /app/data /app/tmp \
    && chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=appuser:appuser /app /app
COPY --from=builder --chown=appuser:appuser /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PYTHONDONTWRITEBYTECODE=1

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Volume configuration
VOLUME ["/app/data", "/tmp"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Resource limits
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    NVIDIA_REQUIRE_CUDA="cuda>=11.8"

# Labels
LABEL maintainer="AI Product Catalog Team" \
      version="1.0.0" \
      description="AI-powered Product Catalog Search System Backend" \
      gpu.support="required"

# Entry point
ENTRYPOINT ["gunicorn"]
CMD ["app.main:app", \
     "--workers=4", \
     "--worker-class=uvicorn.workers.UvicornWorker", \
     "--bind=0.0.0.0:8000", \
     "--timeout=300", \
     "--keep-alive=120", \
     "--max-requests=10000", \
     "--max-requests-jitter=1000", \
     "--graceful-timeout=120"]