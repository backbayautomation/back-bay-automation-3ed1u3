"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision}
Create Date: ${create_date}

Enhanced migration script with transaction management, tenant isolation,
and comprehensive error handling for the AI-powered Product Catalog Search System.
"""
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

from alembic import op  # version: 1.12.0
import sqlalchemy as sa  # version: 2.0.0
from sqlalchemy.dialects import postgresql

# Import metadata for schema validation
from app.db.base import Base

# Configure logging
logger = logging.getLogger('alembic.migration')

# Revision identifiers
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}

def verify_tenant_isolation() -> bool:
    """
    Verifies tenant isolation boundaries before migration operations.
    
    Returns:
        bool: True if tenant isolation is properly configured
    """
    try:
        connection = op.get_bind()
        # Check tenant schema exists
        result = connection.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'tenant'"
        ).scalar()
        if not result:
            raise Exception("Tenant schema not found")
            
        # Verify schema permissions
        result = connection.execute("""
            SELECT has_schema_privilege('tenant', 'USAGE') as has_usage,
                   has_schema_privilege('tenant', 'CREATE') as has_create
        """).first()
        if not (result.has_usage and result.has_create):
            raise Exception("Insufficient schema privileges")
            
        return True
    except Exception as e:
        logger.error(f"Tenant isolation verification failed: {str(e)}")
        return False

def validate_migration_state() -> Dict[str, Any]:
    """
    Validates database state before migration operations.
    
    Returns:
        Dict[str, Any]: State validation results
    """
    try:
        connection = op.get_bind()
        state = {
            'timestamp': datetime.utcnow().isoformat(),
            'checks': {}
        }
        
        # Verify table existence and structure
        for table in Base.metadata.sorted_tables:
            exists = connection.dialect.has_table(connection, table.name, schema='tenant')
            state['checks'][f'table_{table.name}'] = {
                'exists': exists,
                'columns': [c.name for c in table.columns] if exists else []
            }
            
        # Check foreign key constraints
        state['checks']['foreign_keys'] = connection.execute("""
            SELECT conname, conrelid::regclass AS table_name,
                   confrelid::regclass AS referenced_table
            FROM pg_constraint
            WHERE confrelid IS NOT NULL
              AND connamespace = 'tenant'::regnamespace
        """).fetchall()
        
        return state
    except Exception as e:
        logger.error(f"Migration state validation failed: {str(e)}")
        return {'error': str(e)}

def log_migration_event(event_type: str, details: Dict[str, Any]) -> None:
    """
    Logs migration events with detailed context.
    
    Args:
        event_type (str): Type of migration event
        details (Dict[str, Any]): Event details and context
    """
    logger.info(
        "Migration event",
        extra={
            'event_type': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'revision': revision,
            'details': details
        }
    )

def upgrade() -> None:
    """
    Implements forward migration with enhanced transaction management and validation.
    """
    # Verify tenant isolation
    if not verify_tenant_isolation():
        raise Exception("Tenant isolation verification failed")
    
    # Validate pre-migration state
    pre_state = validate_migration_state()
    log_migration_event('pre_upgrade', pre_state)
    
    try:
        # Begin transaction with serializable isolation
        connection = op.get_bind()
        connection.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        
        # Execute upgrade operations
        ${upgrades if upgrades else "pass"}
        
        # Validate post-migration state
        post_state = validate_migration_state()
        log_migration_event('post_upgrade', post_state)
        
    except Exception as e:
        logger.error(
            "Upgrade failed",
            extra={
                'error': str(e),
                'traceback': logging.traceback.format_exc()
            }
        )
        raise

def downgrade() -> None:
    """
    Implements reverse migration with safety checks and data validation.
    """
    # Verify tenant isolation
    if not verify_tenant_isolation():
        raise Exception("Tenant isolation verification failed")
    
    # Validate pre-downgrade state
    pre_state = validate_migration_state()
    log_migration_event('pre_downgrade', pre_state)
    
    try:
        # Begin transaction with serializable isolation
        connection = op.get_bind()
        connection.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        
        # Execute downgrade operations
        ${downgrades if downgrades else "pass"}
        
        # Validate post-downgrade state
        post_state = validate_migration_state()
        log_migration_event('post_downgrade', post_state)
        
    except Exception as e:
        logger.error(
            "Downgrade failed",
            extra={
                'error': str(e),
                'traceback': logging.traceback.format_exc()
            }
        )
        raise