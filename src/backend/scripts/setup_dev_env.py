#!/usr/bin/env python3
"""
Development environment setup script for AI-powered Product Catalog Search System.
Implements secure multi-tenant environment initialization with Azure DevTest Labs integration.

Version: 1.0.0
"""

import os  # version: latest
import shutil  # version: latest
import logging  # version: latest
import argparse  # version: latest
from typing import Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv  # version: 1.0.0
from azure.identity import DefaultAzureCredential  # version: 1.8.0
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
            description='Setup development environment with enhanced security'
        )
        self._add_arguments()

    def _add_arguments(self):
        """Add command line arguments with secure defaults."""
        self.parser.add_argument(
            '--force',
            action='store_true',
            help='Force setup even if environment exists'
        )
        self.parser.add_argument(
            '--tenant-id',
            type=str,
            help='Tenant identifier for multi-tenant setup'
        )
        self.parser.add_argument(
            '--secure-mode',
            action='store_true',
            default=True,
            help='Enable enhanced security controls'
        )
        self.parser.add_argument(
            '--reset-db',
            action='store_true',
            help='Reset database during setup'
        )

    def parse_args(self):
        """Parse and validate command line arguments."""
        args = self.parser.parse_args()
        self.validate_security(args)
        return args

    def validate_security(self, args) -> bool:
        """Validate security-related arguments."""
        if args.secure_mode:
            if not SECURITY_KEY:
                raise ValueError("SECURITY_KEY environment variable is required in secure mode")
            if args.tenant_id and not args.tenant_id.isalnum():
                raise ValueError("Tenant ID must be alphanumeric")
        return True

def setup_environment(force: bool = False, tenant_id: Optional[str] = None, 
                     secure_mode: bool = True) -> bool:
    """Set up development environment with Azure DevTest Labs integration."""
    try:
        logger.info("Starting environment setup", 
                   extra={'tenant_id': tenant_id, 'secure_mode': secure_mode})

        # Initialize Azure credentials
        if secure_mode:
            credential = DefaultAzureCredential()
            devtest_client = DevTestLabsClient(
                credential=credential,
                subscription_id=settings.azure['subscription_id']
            )

        # Create necessary directories
        dirs = ['logs', 'data', 'temp', 'config']
        for dir_name in dirs:
            dir_path = os.path.join(PROJECT_ROOT, dir_name)
            os.makedirs(dir_path, exist_ok=True)
            if secure_mode:
                os.chmod(dir_path, 0o750)  # Secure permissions

        # Setup environment configuration
        env_config = {
            'DATABASE_URL': settings.database['url'],
            'AZURE_TENANT_ID': settings.azure['tenant_id'],
            'VECTOR_DIMENSION': settings.vector_search['dimension'],
            'SECURITY_ENABLED': str(secure_mode).lower(),
            'TENANT_ID': tenant_id or 'default'
        }

        # Encrypt sensitive configuration if in secure mode
        if secure_mode:
            fernet = Fernet(SECURITY_KEY.encode())
            env_config = {
                k: fernet.encrypt(v.encode()).decode() 
                for k, v in env_config.items()
            }

        # Write environment configuration
        env_path = os.path.join(PROJECT_ROOT, '.env')
        with open(env_path, 'w') as f:
            for key, value in env_config.items():
                f.write(f"{key}={value}\n")
        if secure_mode:
            os.chmod(env_path, 0o640)

        # Setup Azure DevTest Lab if enabled
        if secure_mode and settings.azure.get('devtest_lab_name'):
            lab_name = settings.azure['devtest_lab_name']
            devtest_client.labs.create_or_update(
                resource_group_name=settings.azure['resource_group'],
                lab_name=lab_name,
                lab={
                    'location': settings.azure['location'],
                    'tags': {
                        'environment': 'development',
                        'tenant': tenant_id or 'default'
                    }
                }
            )

        logger.info("Environment setup completed successfully")
        return True

    except Exception as e:
        logger.error("Environment setup failed", 
                    extra={'error': str(e), 'tenant_id': tenant_id})
        cleanup_failed_setup(tenant_id, 'environment')
        raise

def setup_database(reset: bool = False, tenant_id: Optional[str] = None,
                  secure_mode: bool = True) -> bool:
    """Initialize multi-tenant development database with security controls."""
    try:
        logger.info("Starting database setup", 
                   extra={'tenant_id': tenant_id, 'reset': reset})

        # Initialize database with tenant isolation
        init_db()

        # Apply security policies if enabled
        if secure_mode:
            with settings.get_db() as db:
                # Create tenant schema
                if tenant_id:
                    db.execute(f"CREATE SCHEMA IF NOT EXISTS tenant_{tenant_id}")
                    db.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA tenant_{tenant_id} "
                             f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user")

                # Setup row-level security
                db.execute("ALTER TABLE documents ENABLE ROW LEVEL SECURITY")
                db.execute("CREATE POLICY tenant_isolation_policy ON documents "
                         "FOR ALL USING (client_id IN "
                         "(SELECT id FROM clients WHERE tenant_id = current_tenant))")

        logger.info("Database setup completed successfully")
        return True

    except Exception as e:
        logger.error("Database setup failed", 
                    extra={'error': str(e), 'tenant_id': tenant_id})
        cleanup_failed_setup(tenant_id, 'database')
        raise

def cleanup_failed_setup(tenant_id: Optional[str], setup_stage: str) -> bool:
    """Perform cleanup operations after failed setup attempts."""
    try:
        logger.info("Starting cleanup after failed setup", 
                   extra={'tenant_id': tenant_id, 'stage': setup_stage})

        if setup_stage == 'environment':
            # Remove created directories
            for dir_name in ['logs', 'data', 'temp', 'config']:
                dir_path = os.path.join(PROJECT_ROOT, dir_name)
                if os.path.exists(dir_path):
                    shutil.rmtree(dir_path)

            # Remove environment file
            env_path = os.path.join(PROJECT_ROOT, '.env')
            if os.path.exists(env_path):
                os.remove(env_path)

        elif setup_stage == 'database':
            # Rollback database changes
            with settings.get_db() as db:
                if tenant_id:
                    db.execute(f"DROP SCHEMA IF EXISTS tenant_{tenant_id} CASCADE")

        logger.info("Cleanup completed successfully")
        return True

    except Exception as e:
        logger.error("Cleanup failed", 
                    extra={'error': str(e), 'tenant_id': tenant_id})
        return False

def main() -> int:
    """Main entry point with enhanced security and multi-tenant support."""
    try:
        # Parse command line arguments
        parser = SetupArgumentParser()
        args = parser.parse_args()

        # Load environment variables
        load_dotenv(os.path.join(PROJECT_ROOT, '.env'))

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
        logger.error("Setup failed", extra={'error': str(e)})
        return 1

if __name__ == '__main__':
    exit(main())