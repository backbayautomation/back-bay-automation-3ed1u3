#!/usr/bin/env python3
"""
Development environment setup script for AI-powered Product Catalog Search System.
Implements secure environment initialization with multi-tenant isolation and Azure DevTest Labs integration.

Version: 1.0.0
"""

import os  # version: latest
import shutil  # version: latest
import logging  # version: latest
import argparse  # version: latest
from dotenv import load_dotenv  # version: 1.0.0
from azure.mgmt.devtestlabs import DevTestLabsClient  # version: 9.0.0
from cryptography.fernet import Fernet  # version: 41.0.0

from ..app.db.init_db import init_db
from ..app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Constants
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SECURITY_KEY = os.getenv('SECURITY_KEY')

class SetupArgumentParser:
    """Enhanced argument parser with security and multi-tenant options."""
    
    def __init__(self):
        """Initialize parser with security and tenant options."""
        self.parser = argparse.ArgumentParser(
            description='Setup development environment with security controls'
        )
        self._add_arguments()

    def _add_arguments(self):
        """Add command line arguments with security focus."""
        self.parser.add_argument(
            '--force',
            action='store_true',
            help='Force setup even if environment exists'
        )
        self.parser.add_argument(
            '--tenant-id',
            type=str,
            help='Tenant identifier for isolation'
        )
        self.parser.add_argument(
            '--secure-mode',
            action='store_true',
            help='Enable enhanced security controls'
        )
        self.parser.add_argument(
            '--reset-db',
            action='store_true',
            help='Reset database schema'
        )

    def validate_security(self, args):
        """Validate security-related arguments."""
        if args.secure_mode and not SECURITY_KEY:
            raise ValueError("Security key required for secure mode")
        if args.tenant_id and not args.tenant_id.isalnum():
            raise ValueError("Tenant ID must be alphanumeric")
        return True

    def parse_args(self):
        """Parse and validate command line arguments."""
        args = self.parser.parse_args()
        self.validate_security(args)
        return args

def setup_environment(force: bool = False, tenant_id: str = None, secure_mode: bool = False) -> bool:
    """
    Set up development environment with Azure DevTest Labs integration and security controls.
    
    Args:
        force: Force setup even if environment exists
        tenant_id: Tenant identifier for isolation
        secure_mode: Enable enhanced security controls
        
    Returns:
        bool: Success status of environment setup
    """
    try:
        logger.info("Starting environment setup", extra={"tenant_id": tenant_id})

        # Initialize encryption for secure mode
        if secure_mode:
            if not SECURITY_KEY:
                raise ValueError("Security key required for secure mode")
            fernet = Fernet(SECURITY_KEY)
        
        # Create environment directories
        env_dirs = [
            os.path.join(PROJECT_ROOT, 'data'),
            os.path.join(PROJECT_ROOT, 'logs'),
            os.path.join(PROJECT_ROOT, 'temp')
        ]
        
        for dir_path in env_dirs:
            if tenant_id:
                dir_path = os.path.join(dir_path, tenant_id)
            os.makedirs(dir_path, exist_ok=force)
            
            # Set secure permissions
            if secure_mode:
                os.chmod(dir_path, 0o700)

        # Setup environment variables
        env_template = os.path.join(PROJECT_ROOT, '.env.template')
        env_file = os.path.join(PROJECT_ROOT, '.env')
        
        if not os.path.exists(env_file) or force:
            shutil.copy2(env_template, env_file)
            logger.info("Created environment file")

        # Initialize Azure DevTest Labs if configured
        if settings.azure.get('devtest_labs'):
            client = DevTestLabsClient(
                credential=settings.azure.get('credential'),
                subscription_id=settings.azure.get('subscription_id')
            )
            
            # Create lab environment
            lab_name = f"catalog-search-dev-{tenant_id}" if tenant_id else "catalog-search-dev"
            client.labs.create_or_update(
                resource_group_name=settings.azure.get('resource_group'),
                lab_name=lab_name,
                lab={
                    "location": settings.azure.get('location', 'eastus'),
                    "tags": {
                        "environment": "development",
                        "tenant": tenant_id or "shared"
                    }
                }
            )
            logger.info("Azure DevTest Lab environment created", extra={"lab_name": lab_name})

        logger.info("Environment setup completed successfully")
        return True

    except Exception as e:
        logger.error(f"Environment setup failed: {str(e)}", exc_info=True)
        cleanup_failed_setup(tenant_id, "environment")
        return False

def setup_database(reset: bool = False, tenant_id: str = None, secure_mode: bool = False) -> bool:
    """
    Initialize multi-tenant development database with security controls.
    
    Args:
        reset: Reset existing database
        tenant_id: Tenant identifier for isolation
        secure_mode: Enable enhanced security controls
        
    Returns:
        bool: Success status of database setup
    """
    try:
        logger.info("Starting database setup", extra={"tenant_id": tenant_id})

        # Initialize database with tenant isolation
        if tenant_id:
            settings.database['schema'] = f"tenant_{tenant_id}"
        
        # Apply security settings for secure mode
        if secure_mode:
            settings.database.update({
                'ssl_mode': 'verify-full',
                'application_name': f'setup_script_{tenant_id or "shared"}',
                'statement_timeout': 30000,
                'lock_timeout': 5000
            })

        # Initialize database schema
        init_db()
        logger.info("Database schema initialized successfully")

        return True

    except Exception as e:
        logger.error(f"Database setup failed: {str(e)}", exc_info=True)
        cleanup_failed_setup(tenant_id, "database")
        return False

def cleanup_failed_setup(tenant_id: str, setup_stage: str) -> bool:
    """
    Perform cleanup operations after failed setup attempts.
    
    Args:
        tenant_id: Tenant identifier
        setup_stage: Stage at which setup failed
        
    Returns:
        bool: Success status of cleanup operation
    """
    try:
        logger.info("Starting cleanup after failed setup", 
                   extra={"tenant_id": tenant_id, "stage": setup_stage})

        if setup_stage == "environment":
            # Remove created directories
            for dir_type in ['data', 'logs', 'temp']:
                dir_path = os.path.join(
                    PROJECT_ROOT, 
                    dir_type,
                    tenant_id if tenant_id else ''
                )
                if os.path.exists(dir_path):
                    shutil.rmtree(dir_path)

        elif setup_stage == "database":
            # Rollback database changes
            with settings.get_db() as db:
                if tenant_id:
                    db.execute(f"DROP SCHEMA IF EXISTS tenant_{tenant_id} CASCADE")
                db.commit()

        logger.info("Cleanup completed successfully")
        return True

    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}", exc_info=True)
        return False

def main() -> int:
    """
    Main entry point with enhanced security and multi-tenant support.
    
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        # Parse command line arguments
        parser = SetupArgumentParser()
        args = parser.parse_args()

        # Load environment variables
        load_dotenv()

        # Configure logging
        logging.basicConfig(
            level=logging.DEBUG if settings.DEBUG else logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # Setup environment
        if not setup_environment(args.force, args.tenant_id, args.secure_mode):
            return 1

        # Setup database
        if not setup_database(args.reset_db, args.tenant_id, args.secure_mode):
            return 1

        logger.info("Development environment setup completed successfully")
        return 0

    except Exception as e:
        logger.error(f"Setup failed: {str(e)}", exc_info=True)
        return 1

if __name__ == "__main__":
    exit(main())