"""
Database initialization module for the AI-powered Product Catalog Search System.
Implements robust database setup with multi-tenant support, comprehensive error handling,
and proper validation checks.

Version: 1.0.0
"""

import logging  # version: latest
from sqlalchemy import inspect, text  # version: 2.0.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0

from .base import Base
from .session import SessionLocal, engine
from ..core.config import settings

# Configure module logger with correlation IDs
logger = logging.getLogger(__name__)

def validate_schema_integrity():
    """
    Validates database schema integrity and required tables.
    
    Returns:
        bool: True if schema is valid, False otherwise
    """
    try:
        inspector = inspect(engine)
        required_tables = {'organizations', 'clients', 'documents'}
        existing_tables = set(inspector.get_table_names(schema='tenant'))
        
        if not required_tables.issubset(existing_tables):
            missing_tables = required_tables - existing_tables
            logger.error(f"Missing required tables: {missing_tables}")
            return False
            
        logger.info("Schema integrity validation successful")
        return True
        
    except Exception as e:
        logger.error(f"Schema validation failed: {str(e)}", exc_info=True)
        return False

def setup_database_triggers():
    """
    Sets up required database triggers and functions.
    
    Returns:
        bool: True if setup successful, False otherwise
    """
    try:
        with SessionLocal() as db:
            # Create updated_at trigger function
            db.execute(text("""
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            """))
            
            # Create triggers for each table
            for table in ['organizations', 'clients', 'documents']:
                db.execute(text(f"""
                    DROP TRIGGER IF EXISTS update_updated_at_trigger ON tenant.{table};
                    CREATE TRIGGER update_updated_at_trigger
                    BEFORE UPDATE ON tenant.{table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                """))
            
            db.commit()
            logger.info("Database triggers setup completed")
            return True
            
    except Exception as e:
        logger.error(f"Trigger setup failed: {str(e)}", exc_info=True)
        return False

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def init_db() -> None:
    """
    Initializes database with comprehensive error handling and retry logic.
    Creates schema, tables, and seeds initial data with proper validation.
    
    Raises:
        Exception: If database initialization fails after retries
    """
    try:
        logger.info("Starting database initialization")
        
        # Create tenant schema if not exists
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS tenant;"))
            conn.commit()
        
        # Create all tables in proper order
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        
        # Validate schema integrity
        if not validate_schema_integrity():
            raise Exception("Schema integrity validation failed")
        
        # Setup database triggers
        if not setup_database_triggers():
            raise Exception("Database trigger setup failed")
        
        # Seed initial data if needed
        with SessionLocal() as db:
            if needs_initial_data(db):
                seed_initial_data(db)
                logger.info("Initial data seeded successfully")
        
        logger.info("Database initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        raise

def needs_initial_data(db) -> bool:
    """
    Checks if database needs initial data seeding.
    
    Args:
        db: Database session
        
    Returns:
        bool: True if seeding needed, False otherwise
    """
    try:
        # Check for existing organizations
        result = db.execute(
            text("SELECT COUNT(*) FROM tenant.organizations")
        ).scalar()
        return result == 0
        
    except Exception as e:
        logger.error(f"Error checking for initial data: {str(e)}", exc_info=True)
        return False

def seed_initial_data(db) -> None:
    """
    Seeds database with required initial data.
    
    Args:
        db: Database session
        
    Raises:
        Exception: If seeding fails
    """
    try:
        # Create default organization
        db.execute(text("""
            INSERT INTO tenant.organizations (id, name, settings, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                'Default Organization',
                '{"features": {}, "preferences": {}, "limits": {}}',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        """))
        
        # Get the organization ID
        org_id = db.execute(
            text("SELECT id FROM tenant.organizations ORDER BY created_at DESC LIMIT 1")
        ).scalar()
        
        # Create default client
        db.execute(text("""
            INSERT INTO tenant.clients (
                id, org_id, name, config, branding, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(),
                :org_id,
                'Default Client',
                '{"features": {}, "access_control": {}, "integrations": {}}',
                '{"colors": {}, "logos": {}, "theme": "light"}',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        """), {"org_id": org_id})
        
        db.commit()
        logger.info("Initial data seeded successfully")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Data seeding failed: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    init_db()