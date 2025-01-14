#!/usr/bin/env python3
"""
Script to generate comprehensive OpenAPI 3.0 specification documentation for the AI-powered Product Catalog Search System API.
Generates detailed API documentation including endpoints, schemas, security definitions, examples, versioning information,
and authentication flows.

Version: 1.0.0
"""

import json  # version: 3.11
import yaml  # version: 6.0.1
import typer  # version: 0.9.0
from pathlib import Path  # version: 3.11
from typing import Dict, Any, Optional

from app.main import app
from app.core.config import settings

# Initialize CLI app
app = typer.Typer(help='OpenAPI specification generator for Product Catalog Search API')

# Default output path
DEFAULT_OUTPUT_PATH = '../../docs/openapi.json'

# Security scheme definitions
SECURITY_SCHEMES = {
    'oauth2_scheme': {
        'type': 'oauth2',
        'flows': {
            'authorizationCode': {
                'authorizationUrl': f'{settings.API_V1_PREFIX}/auth/login',
                'tokenUrl': f'{settings.API_V1_PREFIX}/auth/token',
                'refreshUrl': f'{settings.API_V1_PREFIX}/auth/refresh',
                'scopes': {
                    'read:documents': 'Read document access',
                    'write:documents': 'Write document access',
                    'admin': 'Admin access'
                }
            }
        }
    },
    'jwt_bearer': {
        'type': 'http',
        'scheme': 'bearer',
        'bearerFormat': 'JWT',
        'description': 'JWT token authentication'
    },
    'api_key': {
        'type': 'apiKey',
        'in': 'header',
        'name': 'X-API-Key',
        'description': 'API key authentication for service accounts'
    }
}

def generate_openapi_spec(output_path: str, include_examples: bool = True) -> Dict[str, Any]:
    """
    Generates comprehensive OpenAPI specification with security schemes, versioning, and examples.
    
    Args:
        output_path: Path to save the generated specification
        include_examples: Whether to include request/response examples
        
    Returns:
        Complete OpenAPI specification dictionary
    """
    # Get base OpenAPI schema from FastAPI app
    openapi_schema = app.openapi()
    
    # Update basic information
    openapi_schema.update({
        'info': {
            'title': settings.PROJECT_NAME,
            'version': settings.API_VERSION,
            'description': 'AI-powered Product Catalog Search System API',
            'contact': {
                'name': 'API Support',
                'email': 'api-support@example.com'
            },
            'license': {
                'name': 'Proprietary',
                'url': 'https://example.com/license'
            }
        },
        'servers': [
            {'url': '/api/v1', 'description': 'Version 1'},
            {'url': 'https://api.example.com/v1', 'description': 'Production server'},
            {'url': 'https://api-staging.example.com/v1', 'description': 'Staging server'}
        ]
    })
    
    # Add security schemes
    openapi_schema['components']['securitySchemes'] = SECURITY_SCHEMES
    
    # Add global security requirement
    openapi_schema['security'] = [
        {'oauth2_scheme': []},
        {'jwt_bearer': []},
        {'api_key': []}
    ]
    
    # Add API versioning information
    openapi_schema['info']['x-api-versioning'] = {
        'current': 'v1',
        'supported': ['v1'],
        'deprecated': [],
        'sunset': {}
    }
    
    if include_examples:
        openapi_schema = generate_examples(openapi_schema)
    
    return openapi_schema

def generate_examples(openapi_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates comprehensive request/response examples for all endpoints.
    
    Args:
        openapi_spec: OpenAPI specification dictionary
        
    Returns:
        Updated specification with examples
    """
    # Add authentication flow examples
    openapi_spec['paths']['/auth/login']['post']['requestBody']['content']['application/x-www-form-urlencoded']['example'] = {
        'username': 'user@example.com',
        'password': 'SecureP@ssw0rd123'
    }
    
    openapi_spec['paths']['/auth/login']['post']['responses']['200']['content']['application/json']['example'] = {
        'access_token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
        'token_type': 'bearer',
        'expires_in': 1800
    }
    
    # Add document upload examples
    openapi_spec['paths']['/documents/']['post']['requestBody']['content']['multipart/form-data']['example'] = {
        'file': 'technical_spec.pdf',
        'metadata': {
            'title': 'Technical Specification',
            'category': 'Documentation'
        }
    }
    
    # Add search query examples
    openapi_spec['paths']['/search']['post']['requestBody']['content']['application/json']['example'] = {
        'query': 'specifications for pump model A123',
        'filters': {
            'document_type': 'pdf',
            'date_range': {
                'start': '2024-01-01',
                'end': '2024-12-31'
            }
        }
    }
    
    return openapi_spec

def save_specification(specification: Dict[str, Any], output_path: str) -> None:
    """
    Saves OpenAPI specification to JSON or YAML file with proper formatting.
    
    Args:
        specification: OpenAPI specification dictionary
        output_path: Output file path
    """
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    if output_file.suffix == '.yaml' or output_file.suffix == '.yml':
        with open(output_file, 'w') as f:
            yaml.dump(specification, f, sort_keys=False, indent=2)
    else:
        with open(output_file, 'w') as f:
            json.dump(specification, f, indent=2, sort_keys=False)

@app.command()
@typer.option('--output', '-o', default=DEFAULT_OUTPUT_PATH, help='Output path for OpenAPI specification')
@typer.option('--examples/--no-examples', default=True, help='Include request/response examples')
@typer.option('--format', '-f', default='json', help='Output format (json/yaml)')
def main(output_path: str = DEFAULT_OUTPUT_PATH, include_examples: bool = True, format: str = 'json') -> None:
    """
    Main CLI entry point for OpenAPI generation with configuration options.
    
    Args:
        output_path: Path to save the generated specification
        include_examples: Whether to include examples
        format: Output format (json/yaml)
    """
    try:
        # Generate OpenAPI specification
        specification = generate_openapi_spec(output_path, include_examples)
        
        # Ensure proper file extension
        if format == 'yaml' and not output_path.endswith(('.yaml', '.yml')):
            output_path = output_path.rsplit('.', 1)[0] + '.yaml'
        elif format == 'json' and not output_path.endswith('.json'):
            output_path = output_path.rsplit('.', 1)[0] + '.json'
        
        # Save specification
        save_specification(specification, output_path)
        
        typer.echo(f"OpenAPI specification generated successfully: {output_path}")
        
    except Exception as e:
        typer.echo(f"Error generating OpenAPI specification: {str(e)}", err=True)
        raise typer.Exit(code=1)

if __name__ == "__main__":
    app()
```

This script generates a comprehensive OpenAPI 3.0 specification for the AI-powered Product Catalog Search System with the following key features:

1. Detailed API documentation including all endpoints, schemas, and security definitions
2. OAuth2 and JWT authentication flow documentation
3. API versioning information and deprecation notices
4. Comprehensive request/response examples
5. Multi-environment server configurations
6. Security scheme definitions for OAuth2, JWT, and API keys
7. CLI interface for flexible generation options
8. Support for both JSON and YAML output formats
9. Proper formatting and organization of the specification
10. Error handling and validation

The script can be run from the command line with various options:

```bash
# Generate JSON specification with examples
python generate_openapi.py

# Generate YAML specification without examples
python generate_openapi.py --no-examples --format yaml

# Specify custom output path
python generate_openapi.py --output ../docs/api-spec.json