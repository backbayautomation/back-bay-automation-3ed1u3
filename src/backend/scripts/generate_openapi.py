#!/usr/bin/env python3

import json
import typer
from pathlib import Path
import yaml
from typing import Dict, Any

from app.main import app as fastapi_app
from app.core.config import settings

# Initialize CLI app
app = typer.Typer(help='OpenAPI specification generator for Product Catalog Search API')

# Constants
DEFAULT_OUTPUT_PATH = '../../docs/openapi.json'

# Security scheme definitions
SECURITY_SCHEMES = {
    'oauth2_scheme': {
        'type': 'oauth2',
        'flows': {
            'authorizationCode': {
                'authorizationUrl': f'{settings.API_V1_PREFIX}/auth/authorize',
                'tokenUrl': f'{settings.API_V1_PREFIX}/auth/token',
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
    Generate comprehensive OpenAPI specification with security schemes and examples.
    """
    # Get base OpenAPI schema from FastAPI
    openapi_schema = fastapi_app.openapi()

    # Add API information
    openapi_schema['info'].update({
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
    })

    # Add servers configuration
    openapi_schema['servers'] = [
        {'url': '/api/v1', 'description': 'Production API'},
        {'url': '/api/v1-staging', 'description': 'Staging API'},
        {'url': '/api/v1-dev', 'description': 'Development API'}
    ]

    # Add security schemes
    openapi_schema['components']['securitySchemes'] = SECURITY_SCHEMES

    # Add global security requirement
    openapi_schema['security'] = [
        {'oauth2_scheme': ['read:documents']},
        {'jwt_bearer': []},
        {'api_key': []}
    ]

    if include_examples:
        # Add request/response examples for all endpoints
        for path, methods in openapi_schema['paths'].items():
            for method, operation in methods.items():
                if method.lower() == 'post' and 'documents' in path:
                    operation['requestBody']['content']['multipart/form-data']['examples'] = {
                        'pdf_upload': {
                            'summary': 'PDF Document Upload',
                            'value': {
                                'file': 'technical_spec.pdf',
                                'metadata': {'document_type': 'technical_specification'}
                            }
                        }
                    }

                if 'responses' in operation:
                    for status_code, response in operation['responses'].items():
                        if 'content' in response:
                            for content_type in response['content'].values():
                                if 'schema' in content_type:
                                    content_type['examples'] = generate_examples(
                                        path, method, status_code
                                    )

    return openapi_schema

def generate_examples(path: str, method: str, status_code: str) -> Dict[str, Any]:
    """
    Generate comprehensive request/response examples for endpoints.
    """
    examples = {}

    if 'documents' in path:
        if method.lower() == 'get':
            examples['success_response'] = {
                'summary': 'Successful response',
                'value': {
                    'documents': [
                        {
                            'id': '123e4567-e89b-12d3-a456-426614174000',
                            'filename': 'technical_spec.pdf',
                            'status': 'completed',
                            'metadata': {
                                'page_count': 10,
                                'processed_at': '2024-01-20T12:00:00Z'
                            }
                        }
                    ]
                }
            }
        elif method.lower() == 'post':
            examples['success_response'] = {
                'summary': 'Document created',
                'value': {
                    'id': '123e4567-e89b-12d3-a456-426614174000',
                    'status': 'pending',
                    'upload_url': 'https://storage.example.com/upload/123'
                }
            }

    if 'auth' in path:
        if method.lower() == 'post' and 'login' in path:
            examples['success_response'] = {
                'summary': 'Login successful',
                'value': {
                    'access_token': 'eyJ0eXAiOiJKV1QiLCJhbGc...',
                    'token_type': 'bearer',
                    'expires_in': 3600
                }
            }

    # Add error examples
    if status_code.startswith('4') or status_code.startswith('5'):
        examples['error_response'] = {
            'summary': 'Error response',
            'value': {
                'status': 'error',
                'code': int(status_code),
                'message': 'Error description',
                'correlation_id': '123e4567-e89b-12d3-a456-426614174000'
            }
        }

    return examples

def save_specification(specification: Dict[str, Any], output_path: str) -> None:
    """
    Save OpenAPI specification to JSON or YAML file with proper formatting.
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
def main(output: str = DEFAULT_OUTPUT_PATH, include_examples: bool = True, format: str = 'json') -> None:
    """
    Generate OpenAPI specification with configuration options.
    """
    try:
        # Generate specification
        specification = generate_openapi_spec(output, include_examples)

        # Determine output format
        if format.lower() == 'yaml':
            output = str(Path(output).with_suffix('.yaml'))
        else:
            output = str(Path(output).with_suffix('.json'))

        # Save specification
        save_specification(specification, output)

        typer.echo(f"OpenAPI specification generated successfully: {output}")

    except Exception as e:
        typer.echo(f"Error generating OpenAPI specification: {str(e)}", err=True)
        raise typer.Exit(code=1)

if __name__ == "__main__":
    app()