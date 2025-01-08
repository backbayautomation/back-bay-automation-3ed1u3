# AI-Powered Product Catalog Search System Backend

[![Build Status](https://github.com/organization/project/workflows/backend-ci.yml/badge.svg)](https://github.com/organization/project/actions)
[![Coverage Status](https://codecov.io/gh/organization/project/branch/main/graph/badge.svg?flag=backend)](https://codecov.io/gh/organization/project)
![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Last Updated: 2024-01-20 | Version: 1.0.0

## Overview

The AI-powered Product Catalog Search System backend is a high-performance, scalable solution that leverages advanced AI technologies to automate the extraction, processing, and retrieval of product information from technical documentation. Built with Python 3.11+ and utilizing cutting-edge frameworks and services, the system provides enterprise-grade capabilities for document processing, vector search, and natural language understanding.

### Key Features

- Advanced OCR processing with NVIDIA GPU acceleration
- Vector-based semantic search powered by LLamaindex
- Natural language understanding with GPT-4 integration
- Async processing pipeline for high-performance operations
- Multi-tenant architecture with data isolation
- Enterprise-grade security and monitoring

## Prerequisites

- Python 3.11 or higher
- Poetry package manager (1.4.0+)
- Docker (24.0.0+) and Docker Compose (2.20.0+)
- NVIDIA GPU drivers (latest stable version)
- Azure CLI (2.50.0+)
- Node.js 18+ (for development tools)
- Git 2.40+
- VS Code with recommended extensions

## Technology Stack

### Core Components
- FastAPI (0.103+) - High-performance async web framework
- SQLAlchemy (2.0+) - Async ORM with enterprise features
- Celery (5.3+) - Distributed task processing
- Redis (6.0+) - Caching and message broker
- PostgreSQL (15+) - Primary database with vector extension

### AI/ML Components
- LLamaindex (0.8+) - Vector search and document retrieval
- OpenAI GPT-4 API - Natural language processing
- NVIDIA OCR SDK - Document processing and text extraction

### Cloud Services
- Azure Kubernetes Service (AKS)
- Azure Blob Storage
- Azure Monitor
- Azure Key Vault

## Getting Started

### Installation

1. Clone the repository and set up Git hooks:
```bash
git clone https://github.com/organization/project
cd project/src/backend
git config core.hooksPath .githooks
```

2. Install Poetry and configure the virtual environment:
```bash
curl -sSL https://install.python-poetry.org | python3 -
poetry config virtualenvs.in-project true
poetry env use python3.11
```

3. Install project dependencies:
```bash
poetry install --with gpu
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize development database:
```bash
poetry run alembic upgrade head
poetry run python scripts/seed_db.py
```

### Development Setup

1. Start required Docker services:
```bash
docker-compose up -d
```

2. Configure development server:
```bash
poetry run python scripts/configure_dev.py
```

3. Start development server:
```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. Access API documentation:
- OpenAPI UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development Guidelines

### Code Quality

- Follow PEP 8 style guide
- Maintain test coverage above 85%
- Use type hints and docstrings
- Run pre-commit hooks before commits

### Testing

```bash
# Run unit tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app

# Run integration tests
poetry run pytest tests/integration
```

### Database Migrations

```bash
# Create new migration
poetry run alembic revision --autogenerate -m "description"

# Apply migrations
poetry run alembic upgrade head

# Rollback migration
poetry run alembic downgrade -1
```

## Deployment

### Production Requirements

- Azure subscription with required services
- NVIDIA GPU-enabled AKS cluster
- Azure Container Registry access
- Production SSL certificates
- Azure Key Vault access

### Deployment Steps

1. Build production Docker image:
```bash
docker build -t product-search-backend:latest .
```

2. Push to Azure Container Registry:
```bash
az acr login --name <registry-name>
docker tag product-search-backend:latest <registry-name>.azurecr.io/product-search-backend:latest
docker push <registry-name>.azurecr.io/product-search-backend:latest
```

3. Deploy to AKS:
```bash
kubectl apply -f kubernetes/
```

## Monitoring and Maintenance

- Application metrics available in Azure Monitor
- Log analytics configured for error tracking
- Performance monitoring through Application Insights
- Automated alerts for critical issues
- Regular security scanning and updates

## Support and Contact

For technical support and inquiries:
- Development Team: dev-team@example.com
- Repository: https://github.com/organization/project

## License

This project is licensed under the MIT License - see the LICENSE file for details.