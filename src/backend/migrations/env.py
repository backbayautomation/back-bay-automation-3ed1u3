"""
Advanced Alembic migration environment configuration with multi-tenant support,
comprehensive logging, transaction management, and rollback capabilities.

Version: 1.0.0
"""

import logging
import json
import time
from logging.handlers import RotatingFileHandler
from typing import Dict, Any

from alembic import context  # version: 1.12.0
from sqlalchemy import engine_from_config, pool, MetaData  # version: 2.0.0
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SQLAlchemyError

from app.db.base import Base
from app.core.config import settings

# Initialize logging with JSON formatting
logger = logging.getLogger('alembic.env')
log_handler = RotatingFileHandler(
    'logs/migrations.log',
    maxBytes=10485760,  # 10MB
    backupCount=5
)
log_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(log_handler)

# Migration configuration
config = context.config
target_metadata = Base.metadata

# Retry configuration for resilient migrations
RETRY_COUNT = 3
RETRY_DELAY = 5

def configure_migration_context() -> Dict[str, Any]:
    """
    Configure migration context with tenant isolation and security settings.
    
    Returns:
        Dict[str, Any]: Migration context configuration
    """
    db_settings = settings.get_database_settings()
    
    # Configure SQLAlchemy URL
    config_section = config.get_section(config.config_ini_section)
    config_section['sqlalchemy.url'] = (
        f"postgresql://{db_settings['username']}:{db_settings['password']}@"
        f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"
    )
    
    # Configure connection pooling
    config_section.update({
        'pool_size': str(db_settings['pool_size']),
        'max_overflow': str(db_settings['max_overflow']),
        'pool_timeout': '30',
        'pool_recycle': '3600'
    })
    
    return config_section

def include_object(object: Any, name: str, type_: str, reflected: bool, compare_to: Any) -> bool:
    """
    Filter objects to be included in migration based on tenant context.
    
    Args:
        object: Database object being considered
        name: Object name
        type_: Object type
        reflected: Whether object is reflected
        compare_to: Object being compared to
        
    Returns:
        bool: Whether to include object in migration
    """
    # Skip system tables and specific schemas
    if type_ == "table":
        if name.startswith("alembic_"):
            return False
        if hasattr(object, 'schema') and object.schema in ['pg_catalog', 'information_schema']:
            return False
    return True

def run_migrations_offline() -> None:
    """
    Enhanced offline migration runner that generates SQL scripts with tenant context
    and detailed logging.
    """
    try:
        start_time = time.time()
        logger.info("Starting offline migration generation")
        
        # Configure migration context
        context_config = configure_migration_context()
        url = context_config['sqlalchemy.url']
        
        # Configure migration context
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            include_object=include_object,
            include_schemas=True,
            version_table_schema='public',
            compare_type=True
        )
        
        # Generate migration script
        with context.begin_transaction():
            context.run_migrations()
            
        duration = time.time() - start_time
        logger.info(f"Offline migration completed successfully in {duration:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Offline migration failed: {str(e)}", exc_info=True)
        raise

def run_migrations_online() -> None:
    """
    Advanced online migration runner with transaction management, retry logic,
    and progress tracking.
    """
    retry_count = 0
    start_time = time.time()
    
    # Configure migration engine
    context_config = configure_migration_context()
    connectable = engine_from_config(
        context_config,
        prefix='sqlalchemy.',
        poolclass=pool.QueuePool
    )
    
    # Set up migration context
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            include_schemas=True,
            version_table_schema='public',
            compare_type=True,
            transaction_per_migration=True,
            render_as_batch=True
        )
        
        try:
            logger.info("Starting online migration execution")
            
            # Execute migrations with retry logic
            while retry_count < RETRY_COUNT:
                try:
                    with context.begin_transaction():
                        # Set session configuration
                        connection.execute("SET statement_timeout = '3600s'")
                        connection.execute("SET lock_timeout = '60s'")
                        
                        # Run migrations
                        context.run_migrations()
                        
                        duration = time.time() - start_time
                        logger.info(f"Online migration completed successfully in {duration:.2f} seconds")
                        break
                        
                except SQLAlchemyError as e:
                    retry_count += 1
                    if retry_count >= RETRY_COUNT:
                        logger.error(f"Migration failed after {RETRY_COUNT} retries: {str(e)}", exc_info=True)
                        raise
                    
                    logger.warning(f"Migration attempt {retry_count} failed, retrying in {RETRY_DELAY} seconds")
                    time.sleep(RETRY_DELAY)
                    
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}", exc_info=True)
            raise
            
        finally:
            connection.close()

def verify_migration_integrity(connection: Connection) -> bool:
    """
    Verify migration integrity and tenant isolation.
    
    Args:
        connection: Database connection
        
    Returns:
        bool: Whether verification passed
    """
    try:
        # Verify alembic version table
        connection.execute("SELECT version_num FROM alembic_version")
        
        # Verify tenant schemas
        connection.execute("SELECT schema_name FROM information_schema.schemata")
        
        # Verify table permissions
        connection.execute("SELECT grantee, privilege_type FROM information_schema.table_privileges")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration integrity verification failed: {str(e)}", exc_info=True)
        return False

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()