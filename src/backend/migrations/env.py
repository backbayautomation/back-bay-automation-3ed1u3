"""
Advanced Alembic migration environment configuration for AI-powered Product Catalog Search System.
Implements multi-tenant schema management, transaction handling, and comprehensive logging.

Version: 1.0.0
"""

import logging  # version: latest
import json  # version: latest
import time  # version: latest
from logging.handlers import RotatingFileHandler
from contextlib import contextmanager

from alembic import context  # version: 1.12.0
from sqlalchemy import engine_from_config, pool, create_engine  # version: 2.0.0
from sqlalchemy.exc import OperationalError

from app.db.base import Base
from app.core.config import settings

# Initialize logging with JSON formatting
def configure_logging():
    """Configure comprehensive logging with structured output and multiple handlers."""
    logger = logging.getLogger('alembic.env')
    logger.setLevel(logging.INFO)

    # Create JSON formatter
    class JsonFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': record.getMessage(),
                'module': record.module,
                'function': record.funcName
            }
            if hasattr(record, 'migration_id'):
                log_data['migration_id'] = record.migration_id
            if record.exc_info:
                log_data['exception'] = self.formatException(record.exc_info)
            return json.dumps(log_data)

    # Configure file handler with rotation
    file_handler = RotatingFileHandler(
        'logs/alembic.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(JsonFormatter())
    logger.addHandler(file_handler)

    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JsonFormatter())
    logger.addHandler(console_handler)

    return logger

# Initialize logger
logger = configure_logging()

# Migration configuration
config = context.config
target_metadata = Base.metadata

# Constants for retry logic
RETRY_COUNT = 3
RETRY_DELAY = 5

def get_url():
    """Get database URL with tenant context."""
    db_settings = settings.get_database_settings()
    return (
        f"postgresql://{db_settings['username']}:{db_settings['password']}@"
        f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"
    )

@contextmanager
def transaction_context(connection):
    """Provide transaction context with savepoints and error handling."""
    try:
        transaction = connection.begin()
        logger.info("Starting migration transaction")
        yield transaction
        transaction.commit()
        logger.info("Migration transaction committed successfully")
    except Exception as e:
        logger.error(f"Transaction error: {str(e)}", exc_info=True)
        transaction.rollback()
        logger.info("Migration transaction rolled back")
        raise

def run_migrations_offline():
    """
    Enhanced offline migration runner that generates SQL scripts with tenant context
    and detailed logging.
    """
    start_time = time.time()
    logger.info("Starting offline migration generation")

    try:
        url = get_url()
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema='tenant'
        )

        with context.begin_transaction():
            # Log migration plan
            logger.info("Generating migration plan")
            context.run_migrations()

        duration = time.time() - start_time
        logger.info(f"Offline migration generation completed in {duration:.2f} seconds")

    except Exception as e:
        logger.error(f"Offline migration generation failed: {str(e)}", exc_info=True)
        raise

def run_migrations_online():
    """
    Advanced online migration runner with transaction management, retry logic,
    and progress tracking.
    """
    start_time = time.time()
    logger.info("Starting online migrations")

    # Configure connection pool
    config_section = config.get_section(config.config_ini_section)
    config_section['sqlalchemy.url'] = get_url()
    config_section['sqlalchemy.pool_pre_ping'] = 'true'
    config_section['sqlalchemy.pool_size'] = '5'
    config_section['sqlalchemy.max_overflow'] = '10'

    # Create engine with retry logic
    for attempt in range(RETRY_COUNT):
        try:
            engine = engine_from_config(
                config_section,
                prefix='sqlalchemy.',
                poolclass=pool.QueuePool
            )
            break
        except OperationalError as e:
            if attempt == RETRY_COUNT - 1:
                logger.error("Failed to connect to database after retries", exc_info=True)
                raise
            logger.warning(f"Database connection attempt {attempt + 1} failed, retrying...")
            time.sleep(RETRY_DELAY)

    # Execute migrations with connection handling
    with engine.connect() as connection:
        # Set session configuration
        connection.execute("SET statement_timeout = '300s'")  # 5-minute timeout
        connection.execute("SET lock_timeout = '60s'")        # 1-minute lock timeout

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema='tenant',
            transaction_per_migration=True,
            render_as_batch=True
        )

        try:
            with transaction_context(connection):
                # Log start of migrations
                logger.info("Beginning migration execution")
                context.run_migrations()

            duration = time.time() - start_time
            logger.info(f"Online migrations completed successfully in {duration:.2f} seconds")

        except Exception as e:
            logger.error("Migration failed with error", exc_info=True)
            raise

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()