"""
Database migrations package initialization for AI-powered Product Catalog Search System.
Enables Alembic-based schema management with multi-tenant support and transaction handling.

This package provides the necessary infrastructure for:
- Multi-tenant schema versioning and tracking
- Transaction-safe schema migrations
- Rollback support for failed migrations
- Version compatibility checking across deployments

Referenced by:
- env.py: For running migrations in online/offline modes
- script.py.mako: For migration script templating
"""

# Package version for tracking schema compatibility
__version__ = '1.0.0'

# Package-level initialization - empty by design
# Alembic will use this package to discover migrations
# and manage schema versions through env.py and script.py.mako references