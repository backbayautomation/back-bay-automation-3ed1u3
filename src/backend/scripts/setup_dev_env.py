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
from dotenv import load_dotenv  # version: 1.0.0
from azure.mgmt.devtestlabs import DevTestLabsClient  # version: 9.0.0
from cryptography.fernet import Fernet  # version: 41.0.0

from ..app.db.init_db import init_db
from ..app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SECURITY_KEY = os.getenv('SECURITY_KEY')

class SetupArgumentParser:
    """Enhanced argument parser with security and multi-tenant options."""

    def __init__(self):
        """Initialize parser with security validation options."""
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
            help='Tenant ID for multi-tenant setup'
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
        """Parse and validate arguments with security checks."""
        args = self.parser.parse_args()
        self.validate_security(args)
        return args

    def validate_security(self, args):
        """Validate security-related arguments."""
        if not SECURITY_KEY and args.secure_mode:
            raise ValueError("SECURITY_KEY must be set when secure mode is enabled")
        
        if args.tenant_id and not args.tenant_id.isalnum():
            raise ValueError("Tenant ID must be alphanumeric")

def setup_environment(force: bool, tenant_id: str, secure_mode: bool) -> bool:
    """Set up development environment with Azure DevTest Labs integration."""
    try:
        logger.info("Starting environment setup")
        
        # Initialize Azure DevTest Labs client
        azure_config = settings.azure
        devtest_client = DevTestLabsClient(
            credential=azure_config['client_id'],
            subscription_id=azure_config['subscription_id']
        )

        # Create tenant-specific directories
        tenant_dir = os.path.join(PROJECT_ROOT, 'tenants', tenant_id) if tenant_id else PROJECT_ROOT
        dirs_to_create = ['logs', 'data', 'config', 'temp']
        
        for dir_name in dirs_to_create:
            dir_path = os.path.join(tenant_dir, dir_name)
            if os.path.exists(dir_path) and not force:
                logger.warning(f"Directory {dir_path} already exists")
                continue
                
            os.makedirs(dir_path, mode=0o750, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")

        # Setup encrypted configuration
        if secure_mode:
            fernet = Fernet(SECURITY_KEY.encode())
            config_path = os.path.join(tenant_dir, 'config', '.env')
            
            env_vars = {
                'DB_HOST': settings.database['host'],
                'DB_PORT': str(settings.database['port']),
                'DB_NAME': f"{settings.database['database']}_{tenant_id}" if tenant_id else settings.database['database'],
                'AZURE_TENANT_ID': azure_config['tenant_id'],
                'AZURE_CLIENT_ID': azure_config['client_id']
            }
            
            with open(config_path, 'wb') as f:
                encrypted_config = fernet.encrypt('\n'.join(f"{k}={v}" for k, v in env_vars.items()).encode())
                f.write(encrypted_config)
            
            os.chmod(config_path, 0o600)
            logger.info("Encrypted configuration created")

        # Initialize logging
        log_config = {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'json': {
                    'format': '%(asctime)s %(levelname)s %(message)s',
                    'datefmt': '%Y-%m-%d %H:%M:%S'
                }
            },
            'handlers': {
                'file': {
                    'class': 'logging.FileHandler',
                    'filename': os.path.join(tenant_dir, 'logs', 'setup.log'),
                    'formatter': 'json'
                }
            },
            'root': {
                'level': 'INFO',
                'handlers': ['file']
            }
        }
        logging.config.dictConfig(log_config)
        
        logger.info("Environment setup completed successfully")
        return True

    except Exception as e:
        logger.error(f"Environment setup failed: {str(e)}", exc_info=True)
        return False

def setup_database(reset: bool, tenant_id: str, secure_mode: bool) -> bool:
    """Initialize multi-tenant development database with security controls."""
    try:
        logger.info("Starting database setup")
        
        # Update database settings for tenant
        if tenant_id:
            settings.database['database'] = f"{settings.database['database']}_{tenant_id}"
        
        # Initialize database with tenant isolation
        init_db()
        
        if secure_mode:
            # Setup database security policies
            with settings.get_db() as db:
                # Create tenant schema if not exists
                db.execute(f"CREATE SCHEMA IF NOT EXISTS tenant_{tenant_id}")
                
                # Setup row-level security
                db.execute(f"""
                    ALTER TABLE tenant.organizations 
                    ENABLE ROW LEVEL SECURITY;
                    
                    CREATE POLICY org_tenant_isolation ON tenant.organizations
                    FOR ALL
                    TO PUBLIC
                    USING (tenant_id = '{tenant_id}');
                """)
                
                db.commit()
        
        logger.info("Database setup completed successfully")
        return True

    except Exception as e:
        logger.error(f"Database setup failed: {str(e)}", exc_info=True)
        return False

def cleanup_failed_setup(tenant_id: str, setup_stage: str) -> bool:
    """Perform cleanup operations after failed setup attempts."""
    try:
        logger.info(f"Starting cleanup for failed {setup_stage}")
        
        if tenant_id:
            tenant_dir = os.path.join(PROJECT_ROOT, 'tenants', tenant_id)
            if os.path.exists(tenant_dir):
                shutil.rmtree(tenant_dir)
            
            # Cleanup database
            with settings.get_db() as db:
                db.execute(f"DROP SCHEMA IF EXISTS tenant_{tenant_id} CASCADE")
                db.commit()
        
        logger.info("Cleanup completed successfully")
        return True

    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}", exc_info=True)
        return False

def main() -> int:
    """Main entry point with enhanced security and multi-tenant support."""
    try:
        # Parse command line arguments
        parser = SetupArgumentParser()
        args = parser.parse_args()
        
        # Setup environment
        if not setup_environment(args.force, args.tenant_id, args.secure_mode):
            cleanup_failed_setup(args.tenant_id, 'environment')
            return 1
        
        # Setup database
        if not setup_database(args.reset_db, args.tenant_id, args.secure_mode):
            cleanup_failed_setup(args.tenant_id, 'database')
            return 1
        
        logger.info("Development environment setup completed successfully")
        return 0

    except Exception as e:
        logger.error(f"Setup failed: {str(e)}", exc_info=True)
        return 1

if __name__ == "__main__":
    exit(main())