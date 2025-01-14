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
from sqlalchemy.exc import SQLAlchemyError  # version: ^1.4.0

from app.db.init_db import init_db
from app.models.organization import Organization
from app.models.client import Client

# Configure logging
logger = logging.getLogger(__name__)

# Default values for initial data
DEFAULT_ORG_NAME = "Default Organization"
DEFAULT_CLIENT_NAME = "Default Client"
DEFAULT_ORG_SETTINGS = {
    'features': {
        'document_processing': True,
        'vector_search': True
    },
    'preferences': {
        'default_language': 'en',
        'timezone': 'UTC'
    },
    'limits': {
        'max_documents': 1000,
        'max_users': 50
    }
}
DEFAULT_CLIENT_CONFIG = {
    'features': {
        'chat_interface': True,
        'document_export': True
    },
    'limits': {
        'max_queries_per_hour': 100,
        'max_document_size_mb': 50
    },
    'preferences': {
        'theme': 'light',
        'language': 'en'
    },
    'integrations': {}
}
DEFAULT_CLIENT_BRANDING = {
    'colors': {
        'primary': '#0066CC',
        'secondary': '#4CAF50',
        'accent': '#FFC107'
    },
    'logo': None,
    'favicon': None,
    'fonts': {
        'primary': 'Roboto',
        'secondary': 'Open Sans'
    }
}

def setup_logging(verbose: bool) -> None:
    """
    Configure enhanced logging with structured format and rotation.
    
    Args:
        verbose (bool): Enable verbose logging if True
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('create_initial_data.log')
        ]
    )
    
    # Set SQLAlchemy logging level
    logging.getLogger('sqlalchemy.engine').setLevel(
        logging.INFO if verbose else logging.WARNING
    )

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments.
    
    Returns:
        argparse.Namespace: Validated command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Initialize database with organization and client data'
    )
    
    parser.add_argument(
        '--org-name',
        default=DEFAULT_ORG_NAME,
        help='Name of the organization to create'
    )
    
    parser.add_argument(
        '--client-name',
        default=DEFAULT_CLIENT_NAME,
        help='Name of the client to create'
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
    if len(args.org_name) < 2 or len(args.org_name) > 100:
        parser.error("Organization name must be between 2 and 100 characters")
    
    # Validate client name
    if len(args.client_name) < 2 or len(args.client_name) > 100:
        parser.error("Client name must be between 2 and 100 characters")
    
    return args

def create_organization(session, name: str, settings: dict) -> Organization:
    """
    Create organization with validated settings and error handling.
    
    Args:
        session: Database session
        name: Organization name
        settings: Organization settings dictionary
    
    Returns:
        Organization: Created organization instance
        
    Raises:
        ValueError: If validation fails
        SQLAlchemyError: If database operation fails
    """
    logger.info(f"Creating organization: {name}")
    
    # Check for existing organization
    existing = session.query(Organization).filter(
        Organization.name == name
    ).first()
    if existing:
        raise ValueError(f"Organization '{name}' already exists")
    
    # Create new organization
    org = Organization(
        id=uuid.uuid4(),
        name=name,
        settings=settings,
        created_at=datetime.utcnow()
    )
    
    session.add(org)
    session.flush()
    
    logger.info(f"Created organization with ID: {org.id}")
    return org

def create_client(session, org_id: uuid.UUID, name: str, config: dict, branding: dict) -> Client:
    """
    Create client with validated configuration and branding.
    
    Args:
        session: Database session
        org_id: Organization ID
        name: Client name
        config: Client configuration dictionary
        branding: Client branding dictionary
    
    Returns:
        Client: Created client instance
        
    Raises:
        ValueError: If validation fails
        SQLAlchemyError: If database operation fails
    """
    logger.info(f"Creating client: {name}")
    
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
        config=config,
        branding=branding,
        created_at=datetime.utcnow()
    )
    
    session.add(client)
    session.flush()
    
    logger.info(f"Created client with ID: {client.id}")
    return client

def main() -> int:
    """
    Main script execution with comprehensive error handling.
    
    Returns:
        int: Exit code (0: success, 1: validation error, 2: database error, 3: system error)
    """
    try:
        # Parse arguments and setup logging
        args = parse_args()
        setup_logging(args.verbose)
        
        logger.info("Starting database initialization")
        
        # Initialize database if needed
        try:
            init_db()
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            return 2
        
        # Create database session
        from app.db.session import SessionLocal
        session = SessionLocal()
        
        try:
            # Begin transaction
            with session.begin():
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
                
                if args.dry_run:
                    logger.info("Dry run completed successfully")
                    session.rollback()
                    return 0
                
                # Commit transaction
                session.commit()
                
            logger.info("Database initialization completed successfully")
            return 0
            
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            return 1
            
        except SQLAlchemyError as e:
            logger.error(f"Database error: {e}")
            return 2
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"System error: {e}", exc_info=True)
        return 3

if __name__ == '__main__':
    sys.exit(main())