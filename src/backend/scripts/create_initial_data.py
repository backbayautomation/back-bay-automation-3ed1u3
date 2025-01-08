#!/usr/bin/env python3
"""
Database initialization script for AI-powered Product Catalog Search System.
Creates initial organization and client data with comprehensive validation and error handling.

Version: 1.0.0
"""

import logging  # version: latest
import argparse  # version: latest
import sys  # version: latest
import uuid  # version: latest
from datetime import datetime  # version: latest
from sqlalchemy.exc import SQLAlchemyError  # version: 1.4.0

from app.db.init_db import init_db
from app.models.organization import Organization
from app.models.client import Client

# Configure module logger
logger = logging.getLogger(__name__)

# Default values for initial data
DEFAULT_ORG_NAME = "Default Organization"
DEFAULT_CLIENT_NAME = "Default Client"
DEFAULT_ORG_SETTINGS = {
    'max_users': 10,
    'storage_limit': '5GB',
    'features': ['basic_search', 'document_upload']
}
DEFAULT_CLIENT_CONFIG = {
    'theme': 'light',
    'language': 'en',
    'timezone': 'UTC'
}
DEFAULT_CLIENT_BRANDING = {
    'logo_url': None,
    'primary_color': '#0066CC',
    'secondary_color': '#4CAF50'
}

def setup_logging(verbose: bool) -> None:
    """
    Configure enhanced logging with structured format and correlation IDs.

    Args:
        verbose (bool): Enable verbose logging if True
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    log_format = '%(asctime)s [%(levelname)s] %(message)s [correlation_id=%(correlation_id)s]'
    
    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(logging.Formatter(log_format))
    
    # Configure file handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        'create_initial_data.log',
        maxBytes=10485760,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(logging.Formatter(log_format))
    
    # Set up root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    # Set correlation ID for this run
    logger.correlation_id = str(uuid.uuid4())

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments.

    Returns:
        argparse.Namespace: Validated command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Initialize database with required initial data',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        '--org-name',
        default=DEFAULT_ORG_NAME,
        help='Name of the initial organization'
    )
    
    parser.add_argument(
        '--client-name',
        default=DEFAULT_CLIENT_NAME,
        help='Name of the initial client'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force creation even if data exists'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate without making changes'
    )
    
    args = parser.parse_args()
    
    # Validate organization name
    if not 2 <= len(args.org_name) <= 100:
        parser.error("Organization name must be between 2 and 100 characters")
    
    # Validate client name
    if not 2 <= len(args.client_name) <= 100:
        parser.error("Client name must be between 2 and 100 characters")
    
    return args

def create_organization(session, name: str, settings: dict) -> Organization:
    """
    Create organization with validated settings and error handling.

    Args:
        session: SQLAlchemy session
        name: Organization name
        settings: Organization settings dictionary

    Returns:
        Organization: Created organization instance

    Raises:
        ValueError: If validation fails
        SQLAlchemyError: If database operation fails
    """
    logger.info(f"Creating organization: {name}", extra={'correlation_id': logger.correlation_id})
    
    try:
        # Check for existing organization
        existing = session.query(Organization).filter(Organization.name == name).first()
        if existing:
            raise ValueError(f"Organization '{name}' already exists")
        
        # Create new organization
        org = Organization(
            id=uuid.uuid4(),
            name=name,
            settings={
                'features': settings.get('features', {}),
                'preferences': settings.get('preferences', {}),
                'limits': settings.get('limits', {})
            },
            created_at=datetime.utcnow()
        )
        
        session.add(org)
        session.flush()  # Flush to get the ID
        
        logger.info(
            f"Organization created successfully: {org.id}",
            extra={
                'correlation_id': logger.correlation_id,
                'org_id': str(org.id)
            }
        )
        
        return org
        
    except SQLAlchemyError as e:
        logger.error(
            f"Database error creating organization: {str(e)}",
            extra={
                'correlation_id': logger.correlation_id,
                'error_type': type(e).__name__
            }
        )
        raise

def create_client(session, org_id: uuid.UUID, name: str, config: dict, branding: dict) -> Client:
    """
    Create client with validated configuration and branding.

    Args:
        session: SQLAlchemy session
        org_id: Parent organization ID
        name: Client name
        config: Client configuration dictionary
        branding: Client branding dictionary

    Returns:
        Client: Created client instance

    Raises:
        ValueError: If validation fails
        SQLAlchemyError: If database operation fails
    """
    logger.info(
        f"Creating client: {name}",
        extra={
            'correlation_id': logger.correlation_id,
            'org_id': str(org_id)
        }
    )
    
    try:
        # Check for existing client
        existing = session.query(Client).filter(
            Client.org_id == org_id,
            Client.name == name
        ).first()
        if existing:
            raise ValueError(f"Client '{name}' already exists for organization")
        
        # Create new client
        client = Client(
            id=uuid.uuid4(),
            org_id=org_id,
            name=name,
            config={
                'features': config.get('features', {}),
                'access_control': config.get('access_control', {}),
                'integration_settings': config.get('integration_settings', {}),
                'notification_preferences': config.get('notification_preferences', {})
            },
            branding={
                'theme': branding.get('theme', {}),
                'logo_url': branding.get('logo_url'),
                'favicon_url': branding.get('favicon_url')
            },
            created_at=datetime.utcnow()
        )
        
        session.add(client)
        session.flush()
        
        logger.info(
            f"Client created successfully: {client.id}",
            extra={
                'correlation_id': logger.correlation_id,
                'client_id': str(client.id)
            }
        )
        
        return client
        
    except SQLAlchemyError as e:
        logger.error(
            f"Database error creating client: {str(e)}",
            extra={
                'correlation_id': logger.correlation_id,
                'error_type': type(e).__name__
            }
        )
        raise

def main() -> int:
    """
    Main script execution with comprehensive error handling and validation.

    Returns:
        int: Exit code (0: success, 1: validation error, 2: database error, 3: system error)
    """
    args = parse_args()
    setup_logging(args.verbose)
    
    logger.info(
        "Starting initial data creation",
        extra={
            'correlation_id': logger.correlation_id,
            'org_name': args.org_name,
            'client_name': args.client_name,
            'dry_run': args.dry_run
        }
    )
    
    try:
        # Initialize database
        init_db()
        
        # Start transaction
        from app.db.session import SessionLocal
        session = SessionLocal()
        
        try:
            # Create organization
            org = create_organization(
                session=session,
                name=args.org_name,
                settings=DEFAULT_ORG_SETTINGS
            )
            
            # Create client
            client = create_client(
                session=session,
                org_id=org.id,
                name=args.client_name,
                config=DEFAULT_CLIENT_CONFIG,
                branding=DEFAULT_CLIENT_BRANDING
            )
            
            if not args.dry_run:
                session.commit()
                logger.info(
                    "Initial data created successfully",
                    extra={'correlation_id': logger.correlation_id}
                )
            else:
                session.rollback()
                logger.info(
                    "Dry run completed successfully",
                    extra={'correlation_id': logger.correlation_id}
                )
            
            return 0
            
        except ValueError as e:
            session.rollback()
            logger.error(
                f"Validation error: {str(e)}",
                extra={'correlation_id': logger.correlation_id}
            )
            return 1
            
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(
                f"Database error: {str(e)}",
                extra={'correlation_id': logger.correlation_id}
            )
            return 2
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(
            f"System error: {str(e)}",
            extra={
                'correlation_id': logger.correlation_id,
                'error_type': type(e).__name__
            }
        )
        return 3

if __name__ == '__main__':
    sys.exit(main())