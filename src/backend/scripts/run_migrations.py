#!/usr/bin/env python3
"""
Database migration script for AI-powered Product Catalog Search System.
Provides comprehensive migration management with transaction safety,
tenant isolation, and enhanced logging capabilities.

Version: 1.0.0
"""

import logging
import argparse
import sys
from contextlib import contextmanager
from typing import Optional

import alembic  # version: 1.12.0
from alembic import config as alembic_config
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from ..app.core.config import get_database_settings, get_tenant_settings
from ..app.db.base import Base, metadata

# Configure logging
logger = logging.getLogger('migrations')

# Constants
ALEMBIC_INI_PATH = 'alembic.ini'
EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_INVALID_ARGS = 2

def setup_logging(debug_mode: bool) -> None:
    """
    Configure enhanced logging for migration operations with structured output.

    Args:
        debug_mode (bool): Enable debug level logging if True
    """
    # Create JSON formatter for structured logging
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
        '"message": "%(message)s", "module": "%(module)s"}'
    )

    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Configure file handler for persistent logging
    file_handler = logging.FileHandler('migrations.log')
    file_handler.setFormatter(formatter)

    # Set up logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    logger.setLevel(logging.DEBUG if debug_mode else logging.INFO)

    # Configure alembic logging
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
        help='Target revision for migration (head for latest)',
        default='head'
    )
    
    parser.add_argument(
        '--sql', 
        action='store_true',
        help='Generate SQL statements without executing'
    )
    
    parser.add_argument(
        '--tag',
        help='Optional tag for migration versioning'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate migration without executing'
    )
    
    parser.add_argument(
        '--tenant-check',
        action='store_true',
        help='Validate tenant isolation before migration'
    )
    
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )

    args = parser.parse_args()

    # Validate argument combinations
    if args.sql and args.dry_run:
        parser.error("Cannot specify both --sql and --dry-run")

    return args

@contextmanager
def migration_context(alembic_cfg: Config):
    """
    Context manager for safe migration execution with transaction handling.

    Args:
        alembic_cfg: Alembic configuration object
    """
    # Get database settings
    db_settings = get_database_settings()
    
    # Override alembic.ini settings with current configuration
    alembic_cfg.set_main_option(
        'sqlalchemy.url',
        f"postgresql://{db_settings['username']}:{db_settings['password']}@"
        f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}"
    )

    try:
        yield alembic_cfg
    except Exception as e:
        logger.error(
            "Migration failed",
            extra={
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        )
        raise
    finally:
        logger.info("Migration context cleaned up")

def validate_tenant_isolation() -> bool:
    """
    Validate tenant isolation and schema integrity before migration.

    Returns:
        bool: True if validation passes, False otherwise
    """
    try:
        tenant_settings = get_tenant_settings()
        
        # Verify tenant schemas exist
        for tenant in tenant_settings['tenants']:
            if not metadata.schema.has_schema(tenant['schema']):
                logger.error(
                    f"Missing schema for tenant: {tenant['name']}",
                    extra={'tenant_id': tenant['id']}
                )
                return False

        # Validate foreign key constraints
        for table in metadata.tables.values():
            for fk in table.foreign_keys:
                if fk.column.table.schema != table.schema:
                    logger.error(
                        "Cross-schema foreign key detected",
                        extra={
                            'table': table.name,
                            'foreign_key': fk.target_fullname
                        }
                    )
                    return False

        logger.info("Tenant isolation validation passed")
        return True

    except Exception as e:
        logger.error(
            "Tenant validation failed",
            extra={
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        )
        return False

def run_migrations(args: argparse.Namespace) -> bool:
    """
    Execute database migrations with comprehensive validation and safety checks.

    Args:
        args: Parsed command line arguments

    Returns:
        bool: True if migration succeeds, False otherwise
    """
    try:
        # Load alembic configuration
        alembic_cfg = Config(ALEMBIC_INI_PATH)
        
        with migration_context(alembic_cfg) as cfg:
            # Validate tenant isolation if requested
            if args.tenant_check and not validate_tenant_isolation():
                logger.error("Tenant isolation validation failed")
                return False

            # Initialize migration components
            script = ScriptDirectory.from_config(cfg)
            context = MigrationContext.configure(
                cfg.attributes['connection'],
                opts={'transaction_per_migration': True}
            )

            # Get current and target revisions
            current_rev = context.get_current_revision()
            target_rev = args.revision

            logger.info(
                "Starting migration",
                extra={
                    'current_revision': current_rev,
                    'target_revision': target_rev,
                    'sql_only': args.sql,
                    'dry_run': args.dry_run
                }
            )

            if args.dry_run:
                # Validate migration without executing
                script._upgrade_revs(target_rev, current_rev)
                logger.info("Dry run validation successful")
                return True

            if args.sql:
                # Generate SQL statements
                upgrade_ops = script._upgrade_revs(target_rev, current_rev)
                print(upgrade_ops.to_sql())
                return True

            # Execute migration
            with context.begin_transaction():
                context.run_migrations(
                    tag=args.tag,
                    rev=target_rev
                )

            logger.info(
                "Migration completed successfully",
                extra={
                    'final_revision': context.get_current_revision(),
                    'tag': args.tag
                }
            )
            return True

    except Exception as e:
        logger.error(
            "Migration execution failed",
            extra={
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        )
        return False

def main() -> int:
    """
    Main entry point for migration script with comprehensive error handling.

    Returns:
        int: Exit code indicating success or specific failure reason
    """
    try:
        # Parse command line arguments
        args = parse_args()

        # Configure logging
        setup_logging(args.debug)

        logger.info(
            "Starting migration script",
            extra={'arguments': vars(args)}
        )

        # Execute migrations
        if run_migrations(args):
            logger.info("Migration script completed successfully")
            return EXIT_SUCCESS
        else:
            logger.error("Migration script failed")
            return EXIT_FAILURE

    except Exception as e:
        logger.error(
            "Unhandled exception in migration script",
            extra={
                'error_type': type(e).__name__,
                'error_message': str(e)
            }
        )
        return EXIT_FAILURE

if __name__ == '__main__':
    sys.exit(main())