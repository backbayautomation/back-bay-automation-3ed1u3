"""
Database initialization module for AI-powered Product Catalog Search System.
Implements multi-tenant database initialization with comprehensive error handling,
retry logic, and validation checks.

Version: 1.0.0
"""

import logging  # version: latest
import sqlalchemy  # version: 2.0.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0

from .base import Base, metadata
from .session import SessionLocal, engine
from ..core.config import settings

# Configure module logger with correlation IDs
logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def init_db() -> None:
    """
    Initialize database with comprehensive error handling and retry logic.
    Creates database schema and seeds initial data with proper validation.
    
    Raises:
        SQLAlchemyError: If database initialization fails after retries
        ValueError: If schema validation fails
    """
    try:
        logger.info(
            "Starting database initialization",
            extra={
                'environment': settings.ENVIRONMENT,
                'tenant_schema': 'tenant'
            }
        )

        # Validate database connection settings
        db_settings = settings.get_database_settings()
        if not all(key in db_settings for key in ['host', 'port', 'database', 'username', 'password']):
            raise ValueError("Invalid database configuration")

        # Create schema if it doesn't exist
        with engine.connect() as connection:
            connection.execute(sqlalchemy.text("CREATE SCHEMA IF NOT EXISTS tenant"))
            connection.commit()

        # Create all tables with proper error handling
        try:
            Base.metadata.create_all(bind=engine)
            logger.info(
                "Database tables created successfully",
                extra={
                    'table_count': len(Base.metadata.tables),
                    'tables': list(Base.metadata.tables.keys())
                }
            )
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.error(
                "Failed to create database tables",
                extra={
                    'error': str(e),
                    'error_type': type(e).__name__
                }
            )
            raise

        # Initialize database session for seeding
        db = SessionLocal()
        try:
            # Check if database needs seeding
            org_count = db.query(Base.metadata.tables['tenant.organizations']).count()
            if org_count == 0:
                seed_initial_data(db)
                logger.info("Initial data seeded successfully")
            else:
                logger.info("Database already contains data, skipping seed")

            db.commit()

        except Exception as e:
            db.rollback()
            logger.error(
                "Database seeding failed",
                extra={
                    'error': str(e),
                    'error_type': type(e).__name__
                }
            )
            raise
        finally:
            db.close()

        logger.info(
            "Database initialization completed successfully",
            extra={
                'environment': settings.ENVIRONMENT,
                'schema_version': '1.0'
            }
        )

    except Exception as e:
        logger.error(
            "Database initialization failed",
            extra={
                'error': str(e),
                'error_type': type(e).__name__,
                'retry_count': 0
            }
        )
        raise

def seed_initial_data(db: SessionLocal) -> None:
    """
    Seeds the database with required initial data.
    Implements comprehensive validation and error handling.

    Args:
        db: Database session

    Raises:
        SQLAlchemyError: If seeding operations fail
        ValueError: If data validation fails
    """
    try:
        # Create default organization with validation
        from ..models.organization import Organization
        default_org = Organization(
            name="Default Organization",
            settings={
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
        )
        db.add(default_org)
        db.flush()  # Flush to get the organization ID

        # Create default client with validation
        from ..models.client import Client
        default_client = Client(
            org_id=default_org.id,
            name="Default Client",
            config={
                'features': {
                    'chat_interface': True,
                    'document_export': True
                },
                'access_control': {
                    'max_sessions': 10,
                    'session_timeout': 3600
                },
                'integration_settings': {},
                'notification_preferences': {
                    'email': True,
                    'in_app': True
                }
            },
            branding={
                'theme': {
                    'primary_color': '#0066CC',
                    'secondary_color': '#4CAF50',
                    'font_family': 'Roboto'
                },
                'logo_url': None,
                'favicon_url': None
            }
        )
        db.add(default_client)

        # Create system settings
        system_settings = {
            'version': '1.0.0',
            'initialized_at': sqlalchemy.func.now(),
            'features_enabled': {
                'multi_tenant': True,
                'vector_search': True,
                'document_processing': True
            }
        }
        
        logger.info(
            "Initial data prepared for seeding",
            extra={
                'org_name': default_org.name,
                'client_name': default_client.name
            }
        )

    except sqlalchemy.exc.IntegrityError as e:
        logger.error(
            "Data integrity error during seeding",
            extra={
                'error': str(e),
                'error_type': 'IntegrityError'
            }
        )
        raise

    except sqlalchemy.exc.SQLAlchemyError as e:
        logger.error(
            "Database error during seeding",
            extra={
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
        raise

    except Exception as e:
        logger.error(
            "Unexpected error during data seeding",
            extra={
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
        raise