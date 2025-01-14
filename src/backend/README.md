# AI-Powered Product Catalog Search System Backend

[![Build Status](https://github.com/organization/project/workflows/backend-ci.yml/badge.svg)](https://github.com/organization/project/actions)
[![Coverage Status](https://codecov.io/gh/organization/project/branch/main/graph/badge.svg?flag=backend)](https://codecov.io/gh/organization/project)
![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

The AI-powered Product Catalog Search System backend is a high-performance, scalable solution that leverages advanced AI technologies to automate the extraction, processing, and retrieval of product information from technical documentation. Built with Python 3.11+ and utilizing cutting-edge frameworks and services, the system provides enterprise-grade capabilities for document processing, vector search, and natural language understanding.

Key Features:
- Advanced OCR processing with NVIDIA GPU acceleration
- Vector-based semantic search powered by LLamaindex
- Natural language understanding with GPT-4 integration
- Distributed task processing for scalable document handling
- Multi-tenant data isolation and security
- Real-time chat capabilities with streaming responses
- Comprehensive API documentation and monitoring

## Prerequisites

- Python 3.11 or higher
- Poetry package manager (1.4.0+)
- Docker (24.0.0+) and Docker Compose (2.20.0+)
- NVIDIA GPU drivers (latest stable version)
- Azure CLI (2.50.0+)
- Node.js 18 or higher (for development tools)
- Git 2.40 or higher
- VS Code with recommended extensions

## Technology Stack

### Core Technologies
- FastAPI (0.103.0+) - High-performance async web framework
- SQLAlchemy (2.0.0+) - Async-capable ORM
- Celery (5.3.0+) - Distributed task queue
- Redis (6.0.0+) - Caching and message broker
- PostgreSQL (15.0+) - Primary database with vector extension

### AI/ML Components
- LLamaindex (0.8.0+) - Vector search and retrieval
- OpenAI GPT-4 API - Natural language processing
- NVIDIA OCR SDK - Document processing
- Azure Machine Learning - Model deployment

### Infrastructure
- Azure Kubernetes Service (AKS)
- Azure Blob Storage
- Azure Monitor and Application Insights
- Azure Key Vault

## Getting Started

### Installation

1. Clone the repository and set up Git hooks:
```bash
git clone https://github.com/organization/project
cd project/src/backend
pre-commit install
```

2. Install Poetry and configure virtual environment:
```bash
curl -sSL https://install.python-poetry.org | python3 -
poetry config virtualenvs.in-project true
poetry env use python3.11
```

3. Install project dependencies:
```bash
poetry install --with dev,gpu
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize development database:
```bash
poetry run alembic upgrade head
poetry run python -m scripts.seed_data
```

### Development Setup

1. Start required Docker services:
```bash
docker-compose up -d
```

2. Start development server:
```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Access API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Development Guidelines

- Follow PEP 8 style guide with a maximum line length of 88 characters
- Write comprehensive docstrings using Google style
- Maintain test coverage above 85%
- Use type hints consistently
- Follow conventional commits specification

### Testing

```bash
# Run unit tests
poetry run pytest

# Run with coverage report
poetry run pytest --cov=app --cov-report=html

# Run integration tests
poetry run pytest tests/integration
```

## Deployment

### Production Requirements

- Azure subscription with appropriate permissions
- Azure Container Registry access
- Kubernetes cluster with NVIDIA GPU support
- SSL certificates for domain
- Azure Key Vault for secrets management

### Deployment Steps

1. Build production Docker image:
```bash
docker build -t product-search-backend:latest .
```

2. Deploy to AKS:
```bash
az aks get-credentials --resource-group myResourceGroup --name myAKSCluster
kubectl apply -f k8s/
```

## Documentation

- [API Documentation](docs/api.md)
- [Database Schema](docs/schema.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guidelines](docs/security.md)
- [Contributing Guide](CONTRIBUTING.md)

## Monitoring and Maintenance

- Application metrics available in Azure Application Insights
- Log aggregation through Azure Monitor
- Performance monitoring dashboard in Azure Portal
- Automated alerts for critical metrics
- Regular security scanning and updates

## License

MIT License - see [LICENSE](LICENSE) for details

## Contact

Development Team - dev-team@example.com

---
Last Updated: 2024-01-20
Version: 1.0.0