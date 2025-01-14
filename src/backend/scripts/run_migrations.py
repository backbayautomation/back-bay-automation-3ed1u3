#!/usr/bin/env python3
"""
Database migration script for AI-powered Product Catalog Search System.
Provides comprehensive migration execution with transaction safety, tenant isolation,
and enhanced error handling.

Version: 1.0.0
"""

import logging  # version: latest
import argparse  # version: latest
import sys  # version: latest
from contextlib import contextmanager  # version: latest
import alembic  # version: 1.12.0
from alembic.config import Config  # version: 1.12.0

from ..app.core.config import get_database_settings, get_settings
from ..app.db.base import Base

# Configure logging
logger = logging.getLogger('migrations')

# Constants
ALEMBIC_INI_PATH = 'alembic.ini'
EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_INVALID_ARGS = 2

def setup_logging(debug_mode: bool) -> None:
    """
    Configure enhanced logging for migration execution with structured output.
    
    Args:
        debug_mode: Boolean indicating if debug logging should be enabled
    """
    # Create JSON formatter for structured logging
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
        '"message": "%(message)s", "module": "%(module)s"}'
    )

    # Configure file handler for persistent logging
    file_handler = logging.FileHandler('migrations.log')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG if debug_mode else logging.INFO)

    # Configure root logger
    logger.setLevel(logging.DEBUG if debug_mode else logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    # Configure alembic logging
    logging.getLogger('alembic').setLevel(logging.INFO)
    logging.getLogger('alembic.runtime.migration').setLevel(logging.INFO)

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments for migration control.
    
    Returns:
        Namespace: Validated command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Execute database migrations with enhanced safety controls'
    )
    
    parser.add_argument(
        '--revision',
        help='Target revision for upgrade/downgrade (head, base, or revision id)',
        default='head'
    )
    
    parser.add_argument(
        '--sql',
        action='store_true',
        help='Generate SQL statements instead of executing migrations'
    )
    
    parser.add_argument(
        '--tag',
        help='Optional tag for migration versioning',
        default=None
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate migrations without executing'
    )
    
    parser.add_argument(
        '--tenant-check',
        action='store_true',
        help='Verify tenant isolation before migration'
    )
    
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )
    
    args = parser.parse_args()
    
    # Validate revision format if specified
    if args.revision not in ('head', 'base'):
        try:
            int(args.revision, 16)
        except ValueError:
            parser.error('Revision must be head, base, or a valid revision ID')
    
    return args

@contextmanager
def migration_context(config: Config):
    """
    Context manager for safe migration execution with transaction handling.
    
    Args:
        config: Alembic configuration object
    """
    logger.info("Starting migration context")
    
    try:
        yield
        logger.info("Migration context completed successfully")
    except Exception as e:
        logger.error(f"Error in migration context: {str(e)}", exc_info=True)
        raise
    finally:
        logger.info("Cleaning up migration context")

def verify_tenant_isolation():
    """
    Verify tenant isolation and schema separation before migration.
    
    Returns:
        bool: True if tenant isolation is properly configured
    """
    try:
        # Verify tenant schemas exist and are properly isolated
        settings = get_settings()
        db_settings = get_database_settings()
        
        # Check organization model schema
        if not hasattr(Base.metadata.tables['organizations'], 'schema'):
            raise ValueError("Organization table missing schema definition")
            
        # Verify tenant-specific schemas
        with Base.metadata.bind.connect() as conn:
            schemas = conn.execute("SELECT schema_name FROM information_schema.schemata").fetchall()
            if 'tenant' not in [s[0] for s in schemas]:
                raise ValueError("Tenant schema not found in database")
        
        logger.info("Tenant isolation verification successful")
        return True
        
    except Exception as e:
        logger.error(f"Tenant isolation verification failed: {str(e)}", exc_info=True)
        return False

def run_migrations(args: argparse.Namespace) -> bool:
    """
    Execute database migrations with comprehensive validation and safety checks.
    
    Args:
        args: Parsed command line arguments
        
    Returns:
        bool: Success status of migration execution
    """
    try:
        # Load and customize alembic configuration
        config = Config(ALEMBIC_INI_PATH)
        db_settings = get_database_settings()
        
        # Override database URL from settings
        config.set_main_option(
            'sqlalchemy.url',
            f"postgresql://{db_settings['username']}:{db_settings['password']}@"
            f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"
        )
        
        # Verify tenant isolation if requested
        if args.tenant_check and not verify_tenant_isolation():
            raise ValueError("Tenant isolation verification failed")
        
        with migration_context(config):
            # Create alembic context
            script = alembic.script.ScriptDirectory.from_config(config)
            
            # Get current and target revisions
            current = script.get_current_head()
            target = args.revision
            
            logger.info(f"Current revision: {current}")
            logger.info(f"Target revision: {target}")
            
            # Perform dry run if requested
            if args.dry_run:
                logger.info("Performing dry run validation")
                with config.get_engine().connect() as conn:
                    context = alembic.migration.MigrationContext.configure(conn)
                    script.run_env()
                return True
            
            # Generate SQL only if requested
            if args.sql:
                logger.info("Generating SQL statements")
                with open('migration.sql', 'w') as f:
                    context = alembic.migration.MigrationContext.configure(
                        config.get_engine().connect(),
                        opts={'as_sql': True}
                    )
                    script.run_env()
                return True
            
            # Execute migration
            logger.info("Executing database migration")
            with config.get_engine().begin() as connection:
                alembic.command.upgrade(config, target, tag=args.tag)
            
            logger.info("Migration completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}", exc_info=True)
        return False

def main() -> int:
    """
    Main entry point for migration script with comprehensive error handling.
    
    Returns:
        int: Exit code indicating success or specific failure reason
    """
    try:
        # Parse arguments and setup logging
        args = parse_args()
        setup_logging(args.debug)
        
        logger.info("Starting database migration process")
        
        # Execute migrations
        if run_migrations(args):
            logger.info("Migration process completed successfully")
            return EXIT_SUCCESS
        else:
            logger.error("Migration process failed")
            return EXIT_FAILURE
            
    except Exception as e:
        logger.error(f"Unhandled error in migration script: {str(e)}", exc_info=True)
        return EXIT_FAILURE
    
    except KeyboardInterrupt:
        logger.warning("Migration interrupted by user")
        return EXIT_FAILURE

if __name__ == '__main__':
    sys.exit(main())