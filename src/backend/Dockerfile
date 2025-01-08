# Builder stage
FROM python:3.11-slim AS builder

# Set build arguments and labels
LABEL maintainer="AI Product Catalog Team" \
      version="1.0.0" \
      description="AI-powered Product Catalog Search System Backend" \
      gpu.support="required"

# Set environment variables for build
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VERSION=1.5.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root

# Copy application code
COPY . .

# Generate optimized bytecode
RUN python -m compileall /app

# Runtime stage
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04 AS runtime

# Set runtime labels
LABEL maintainer="AI Product Catalog Team" \
      version="1.0.0" \
      description="AI-powered Product Catalog Search System Backend" \
      gpu.support="required"

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Install Python and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-distutils \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Create application directories
RUN mkdir -p /app/data /tmp/processing \
    && chown -R appuser:appuser /app /tmp/processing

# Set working directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=appuser:appuser /app /app
COPY --from=builder --chown=appuser:appuser /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Set resource limits
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    NVIDIA_REQUIRE_CUDA="cuda>=11.8"

# Configure volume mounts
VOLUME ["/app/data", "/tmp/processing"]

# Set entry point with optimized Gunicorn settings
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