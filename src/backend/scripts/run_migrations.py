#!/usr/bin/env python3
"""
Database migration script for AI-powered Product Catalog Search System.
Provides automated execution of Alembic migrations with comprehensive error handling,
transaction management, tenant isolation, and enhanced logging capabilities.

Version: 1.0.0
"""

import logging
import argparse
import sys
from contextlib import contextmanager
from datetime import datetime
import json

# version: 1.12.0
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

# Internal imports
from app.core.config import get_database_settings, get_settings
from app.db.base import Base

# Global constants
ALEMBIC_INI_PATH = 'alembic.ini'
EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_INVALID_ARGS = 2

# Configure logger
logger = logging.getLogger('migrations')

class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured migration logging."""
    
    def format(self, record):
        """Format log record as JSON with migration-specific fields."""
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'migration_id': getattr(record, 'migration_id', None),
            'tenant_id': getattr(record, 'tenant_id', None),
            'duration_ms': getattr(record, 'duration_ms', None)
        }
        return json.dumps(log_data)

def setup_logging(debug_mode: bool) -> None:
    """
    Configure enhanced logging for migration execution.
    
    Args:
        debug_mode (bool): Enable debug logging if True
    """
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Configure console handler with JSON formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JsonFormatter())
    logger.addHandler(console_handler)
    
    # Configure file handler for persistent logging
    file_handler = logging.FileHandler('migrations.log')
    file_handler.setFormatter(JsonFormatter())
    logger.addHandler(file_handler)
    
    # Set appropriate log level
    logger.setLevel(logging.DEBUG if debug_mode else logging.INFO)
    
    # Configure alembic logging integration
    logging.getLogger('alembic').setLevel(logging.INFO)
    logging.getLogger('alembic.runtime.migration').setLevel(logging.INFO)

def parse_args() -> argparse.Namespace:
    """
    Parse and validate command line arguments for migration control.
    
    Returns:
        argparse.Namespace: Validated command line arguments
    """
    parser = argparse.ArgumentParser(
        description='Execute database migrations with enhanced safety controls'
    )
    
    parser.add_argument(
        '--revision',
        help='Target revision (head for latest)',
        default='head'
    )
    
    parser.add_argument(
        '--sql',
        action='store_true',
        help='Generate SQL instead of executing migrations'
    )
    
    parser.add_argument(
        '--tag',
        help='Optional tag for migration versioning'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate migrations without executing'
    )
    
    parser.add_argument(
        '--tenant-check',
        action='store_true',
        help='Validate tenant isolation'
    )
    
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )
    
    return parser.parse_args()

@contextmanager
def migration_transaction(alembic_cfg: Config):
    """
    Context manager for safe migration transactions.
    
    Args:
        alembic_cfg (Config): Alembic configuration object
    """
    # Get database connection
    db_settings = get_database_settings()
    engine = alembic_cfg.attributes['connection']
    
    try:
        # Begin transaction
        trans = engine.begin()
        logger.info("Started migration transaction")
        
        yield trans
        
        # Commit if no exceptions
        trans.commit()
        logger.info("Migration transaction committed successfully")
        
    except Exception as e:
        # Rollback on any error
        trans.rollback()
        logger.error(f"Migration failed, rolling back: {str(e)}", exc_info=True)
        raise
    
    finally:
        engine.dispose()

def validate_tenant_isolation(alembic_cfg: Config) -> bool:
    """
    Validate tenant isolation for multi-tenant migrations.
    
    Args:
        alembic_cfg (Config): Alembic configuration object
        
    Returns:
        bool: True if validation passes
    """
    try:
        # Get migration context
        context = MigrationContext.configure(alembic_cfg.attributes['connection'])
        
        # Verify tenant schema exists
        result = context.connection.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'tenant'"
        ).fetchone()
        
        if not result:
            logger.error("Tenant schema not found")
            return False
        
        # Verify tenant isolation in migrations
        script = ScriptDirectory.from_config(alembic_cfg)
        for rev in script.walk_revisions():
            if not hasattr(rev, 'tenant_safe'):
                logger.warning(f"Migration {rev.revision} missing tenant safety check")
                return False
        
        logger.info("Tenant isolation validation passed")
        return True
        
    except Exception as e:
        logger.error(f"Tenant validation failed: {str(e)}", exc_info=True)
        return False

def run_migrations(args: argparse.Namespace) -> bool:
    """
    Execute database migrations with comprehensive validation and safety checks.
    
    Args:
        args (argparse.Namespace): Command line arguments
        
    Returns:
        bool: True if migrations completed successfully
    """
    start_time = datetime.utcnow()
    
    try:
        # Load Alembic configuration
        alembic_cfg = Config(ALEMBIC_INI_PATH)
        
        # Override database URL from settings
        db_settings = get_database_settings()
        alembic_cfg.set_main_option(
            'sqlalchemy.url',
            f"postgresql://{db_settings['username']}:{db_settings['password']}@"
            f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"
        )
        
        # Validate tenant isolation if requested
        if args.tenant_check and not validate_tenant_isolation(alembic_cfg):
            logger.error("Tenant isolation validation failed")
            return False
        
        # Execute migrations within transaction
        with migration_transaction(alembic_cfg) as trans:
            if args.sql:
                # Generate SQL
                command.upgrade(alembic_cfg, args.revision, sql=True)
                logger.info("Generated SQL for migrations")
            
            elif args.dry_run:
                # Validate without executing
                command.upgrade(alembic_cfg, args.revision, check_only=True)
                logger.info("Dry run validation successful")
            
            else:
                # Execute migrations
                command.upgrade(alembic_cfg, args.revision)
                
                if args.tag:
                    command.tag(alembic_cfg, args.tag)
                
                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                logger.info(
                    "Migrations completed successfully",
                    extra={
                        'duration_ms': duration,
                        'revision': args.revision,
                        'tag': args.tag
                    }
                )
        
        return True
        
    except Exception as e:
        logger.error(f"Migration execution failed: {str(e)}", exc_info=True)
        return False

def main() -> int:
    """
    Main entry point for migration script with comprehensive error handling.
    
    Returns:
        int: Exit code indicating success or specific failure reason
    """
    try:
        # Parse arguments
        args = parse_args()
        
        # Setup logging
        setup_logging(args.debug)
        
        logger.info(
            "Starting database migrations",
            extra={'revision': args.revision, 'tag': args.tag}
        )
        
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