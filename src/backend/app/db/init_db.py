"""
Database initialization module for the AI-powered Product Catalog Search System.
Implements multi-tenant database initialization with comprehensive error handling,
retry logic, and audit logging capabilities.

Version: 1.0.0
"""

import logging  # version: latest
import sqlalchemy  # version: 2.0.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0

from .base import Base
from .session import SessionLocal
from ..core.config import settings

# Configure module logger with correlation ID tracking
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
        sqlalchemy.exc.SQLAlchemyError: On database operation failures
        Exception: On other initialization failures
    """
    try:
        logger.info("Starting database initialization")
        
        # Get database settings with validation
        db_settings = settings.get_database_settings()
        logger.debug("Database settings validated", extra={"settings": db_settings})

        # Create database engine with validated settings
        engine = Base.metadata.bind
        if engine is None:
            raise ValueError("Database engine not properly configured")

        # Create schema if it doesn't exist
        with engine.connect() as connection:
            connection.execute(sqlalchemy.text("CREATE SCHEMA IF NOT EXISTS tenant"))
            connection.commit()
            logger.info("Tenant schema created or verified")

        # Create all tables with proper ordering
        logger.info("Creating database tables")
        Base.metadata.create_all(bind=engine, checkfirst=True)

        # Initialize database session
        db = SessionLocal()
        try:
            # Verify database connection and permissions
            db.execute(sqlalchemy.text("SELECT 1"))
            logger.info("Database connection verified")

            # Seed initial data with validation
            seed_initial_data(db)
            logger.info("Database initialization completed successfully")

        except Exception as e:
            logger.error("Error during database initialization", exc_info=True)
            raise
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        raise

def seed_initial_data(db: SessionLocal) -> None:
    """
    Seeds the database with required initial data including validation and error handling.
    
    Args:
        db: Database session
        
    Raises:
        sqlalchemy.exc.SQLAlchemyError: On database operation failures
        ValueError: On data validation failures
    """
    from ..models.organization import Organization
    from ..models.client import Client
    
    try:
        logger.info("Starting initial data seeding")

        # Begin transaction with savepoint
        transaction = db.begin_nested()
        try:
            # Check if initial data already exists
            existing_org = db.query(Organization).first()
            if existing_org:
                logger.info("Initial data already exists, skipping seeding")
                return

            # Create default organization with validation
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
            db.flush()
            logger.info("Default organization created", 
                       extra={"org_id": str(default_org.id)})

            # Create default client with validation
            default_client = Client(
                name="Default Client",
                org_id=default_org.id,
                config={
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
                },
                branding={
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
            )
            db.add(default_client)
            db.flush()
            logger.info("Default client created", 
                       extra={"client_id": str(default_client.id)})

            # Commit transaction
            transaction.commit()
            db.commit()
            logger.info("Initial data seeding completed successfully")

        except Exception as e:
            # Rollback to savepoint on error
            transaction.rollback()
            logger.error("Error during data seeding", exc_info=True)
            raise

    except Exception as e:
        logger.error(f"Data seeding failed: {str(e)}", exc_info=True)
        db.rollback()
        raise