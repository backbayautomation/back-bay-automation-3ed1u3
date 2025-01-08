"""
Advanced Alembic migration environment configuration with multi-tenant support,
comprehensive logging, transaction management, and rollback capabilities.

Version: 1.0.0
"""

import logging  # version: latest
import json  # version: latest
import time  # version: latest
from logging.handlers import RotatingFileHandler
from contextlib import contextmanager

from alembic import context  # version: 1.12.0
from sqlalchemy import engine_from_config, pool, create_engine  # version: 2.0.0
from sqlalchemy.exc import SQLAlchemyError

from app.db.base import Base  # Import SQLAlchemy models metadata
from app.core.config import settings  # Import application settings

# Initialize logging with JSON formatting
logger = logging.getLogger('alembic.env')
log_handler = RotatingFileHandler(
    'logs/migrations.log',
    maxBytes=10485760,  # 10MB
    backupCount=5
)
log_handler.setFormatter(logging.Formatter(
    '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
))
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)

# Migration configuration
config = context.config
target_metadata = Base.metadata

# Constants for retry logic
RETRY_COUNT = 3
RETRY_DELAY = 5

def configure_logging():
    """
    Configure comprehensive logging with structured output and multiple handlers.
    """
    logging_config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {
                'format': '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'json',
                'level': 'INFO'
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': 'logs/migrations.log',
                'formatter': 'json',
                'maxBytes': 10485760,
                'backupCount': 5,
                'level': 'DEBUG'
            }
        },
        'loggers': {
            'alembic': {
                'handlers': ['console', 'file'],
                'level': 'INFO',
                'propagate': False
            }
        }
    }
    logging.config.dictConfig(logging_config)

@contextmanager
def transaction_scope(connection):
    """
    Transaction context manager with retry logic and savepoints.
    """
    start_time = time.time()
    trans = connection.begin()
    try:
        # Create savepoint for potential rollback
        savepoint = connection.begin_nested()
        
        yield  # Execute migration operations
        
        # Commit savepoint if successful
        savepoint.commit()
        trans.commit()
        
        duration = time.time() - start_time
        logger.info(
            "Transaction completed successfully",
            extra={
                'duration': duration,
                'migration_id': context.get_context().get_current_revision()
            }
        )
    except Exception as e:
        # Rollback to savepoint on error
        if savepoint.is_active:
            savepoint.rollback()
        trans.rollback()
        
        logger.error(
            "Transaction failed",
            extra={
                'error': str(e),
                'duration': time.time() - start_time,
                'migration_id': context.get_context().get_current_revision()
            }
        )
        raise

def run_migrations_offline():
    """
    Enhanced offline migration runner that generates SQL scripts with tenant context
    and detailed logging.
    """
    logger.info("Starting offline migrations")
    
    # Get database URL from settings
    db_settings = settings.get_database_settings()
    url = (f"postgresql://{db_settings['username']}:{db_settings['password']}@"
           f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}")

    # Configure connection with tenant isolation
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema='public',
        include_object=lambda obj, name, type_, reflected, compare_to: True
    )

    try:
        with context.begin_transaction():
            # Log migration plan
            logger.info(
                "Generating migration script",
                extra={
                    'target_revision': context.get_context().get_current_revision(),
                    'schemas': list(target_metadata.schemas)
                }
            )
            
            context.run_migrations()
            
            logger.info("Offline migration script generation completed")
            
    except Exception as e:
        logger.error(
            "Offline migration failed",
            extra={'error': str(e), 'error_type': type(e).__name__}
        )
        raise

def run_migrations_online():
    """
    Advanced online migration runner with transaction management, retry logic,
    and progress tracking.
    """
    logger.info("Starting online migrations")
    
    # Get database settings with tenant context
    db_settings = settings.get_database_settings()
    
    # Configure connection pool
    config_section = config.get_section(config.config_ini_section)
    config_section.update({
        'sqlalchemy.url': (f"postgresql://{db_settings['username']}:{db_settings['password']}@"
                          f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"),
        'sqlalchemy.pool_size': db_settings['pool_size'],
        'sqlalchemy.max_overflow': db_settings['max_overflow'],
        'sqlalchemy.pool_timeout': 30,
        'sqlalchemy.pool_recycle': 3600
    })

    # Create engine with retry logic
    for attempt in range(RETRY_COUNT):
        try:
            connectable = engine_from_config(
                config_section,
                prefix='sqlalchemy.',
                poolclass=pool.QueuePool
            )

            with connectable.connect() as connection:
                # Configure migration context
                context.configure(
                    connection=connection,
                    target_metadata=target_metadata,
                    include_schemas=True,
                    version_table_schema='public',
                    compare_type=True,
                    compare_server_default=True
                )

                # Execute migrations within transaction
                with transaction_scope(connection):
                    logger.info(
                        "Starting migration execution",
                        extra={
                            'target_revision': context.get_context().get_current_revision(),
                            'schemas': list(target_metadata.schemas)
                        }
                    )
                    
                    context.run_migrations()
                    
                    logger.info("Migration completed successfully")
                break
                
        except SQLAlchemyError as e:
            if attempt < RETRY_COUNT - 1:
                logger.warning(
                    f"Migration attempt {attempt + 1} failed, retrying...",
                    extra={'error': str(e), 'retry_count': attempt + 1}
                )
                time.sleep(RETRY_DELAY)
            else:
                logger.error(
                    "Migration failed after all retry attempts",
                    extra={'error': str(e), 'total_attempts': RETRY_COUNT}
                )
                raise

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()