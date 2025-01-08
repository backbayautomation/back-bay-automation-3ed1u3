"""
Pytest configuration file providing comprehensive test fixtures for database sessions,
authentication, multi-tenant isolation, and test data management.

Version: 1.0.0
"""

import logging
import uuid
from typing import Generator, Dict, Any
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient  # version: 0.100.0

from ..app.db.session import SessionLocal, Base
from ..app.core.config import settings
from ..app.models.user import User
from ..app.constants import UserRole

# Configure test logger
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def test_db_engine():
    """Create test database engine with enhanced monitoring and isolation."""
    # Get test database settings
    db_settings = settings.get_database_settings()
    test_db_url = (
        f"postgresql://{db_settings['username']}:{db_settings['password']}@"
        f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}_test"
    )

    # Create test engine with optimized settings
    engine = create_engine(
        test_db_url,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True,
        connect_args={
            'connect_timeout': 10,
            'application_name': 'catalog_search_test',
            'options': '-c statement_timeout=30000'
        }
    )

    # Set up query logging for debugging
    if settings.DEBUG:
        event.listen(engine, 'before_cursor_execute', lambda *args: logger.debug(f"Executing query: {args[2]}"))

    # Create test schema and tables
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup test database
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_db(test_db_engine) -> Generator[Session, None, None]:
    """
    Creates and manages test database session with enhanced isolation and monitoring.
    Implements transaction rollback after each test.
    """
    # Create test session factory
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_db_engine,
        expire_on_commit=False
    )
    
    # Create test session
    session = TestingSessionLocal()
    
    try:
        # Set session configuration
        session.execute("SET statement_timeout TO '30s'")
        session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        
        logger.debug("Test database session created")
        yield session
        
    finally:
        # Rollback and close session
        session.rollback()
        session.close()
        logger.debug("Test database session closed")

@pytest.fixture(scope="function")
def test_organization(test_db: Session) -> Dict[str, Any]:
    """Creates test organization with proper tenant isolation."""
    org_data = {
        "id": uuid.uuid4(),
        "name": f"Test Organization {uuid.uuid4().hex[:8]}",
        "settings": {
            "features": {"chat": True, "export": True},
            "preferences": {"theme": "light"},
            "limits": {"max_users": 10, "max_documents": 1000}
        }
    }
    
    test_db.execute(
        f"""
        INSERT INTO tenant.organizations (id, name, settings)
        VALUES ('{org_data['id']}', '{org_data['name']}', '{org_data['settings']}')
        """
    )
    test_db.commit()
    
    return org_data

@pytest.fixture(scope="function")
def test_client(test_db: Session, test_organization: Dict[str, Any]) -> Dict[str, Any]:
    """Creates test client with proper tenant isolation."""
    client_data = {
        "id": uuid.uuid4(),
        "org_id": test_organization["id"],
        "name": f"Test Client {uuid.uuid4().hex[:8]}",
        "config": {
            "features": {"chat": True},
            "access_control": {"max_users": 5},
            "integrations": {}
        },
        "branding": {
            "colors": {"primary": "#0066CC"},
            "logos": {},
            "theme": "light"
        }
    }
    
    test_db.execute(
        f"""
        INSERT INTO tenant.clients (id, org_id, name, config, branding)
        VALUES (
            '{client_data['id']}', '{client_data['org_id']}',
            '{client_data['name']}', '{client_data['config']}',
            '{client_data['branding']}'
        )
        """
    )
    test_db.commit()
    
    return client_data

@pytest.fixture(scope="function")
def test_user(test_db: Session, test_client: Dict[str, Any]) -> User:
    """Creates test user with comprehensive role and tenant configuration."""
    user = User(
        id=uuid.uuid4(),
        org_id=test_client["org_id"],
        client_id=test_client["id"],
        email=f"test.user.{uuid.uuid4().hex[:8]}@example.com",
        full_name="Test User",
        role=UserRole.REGULAR_USER.value,
        is_active=True
    )
    
    # Set secure test password
    user.set_password("TestPass123!@#")
    
    # Add user to database
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    return user

@pytest.fixture(scope="function")
def test_admin_user(test_db: Session, test_organization: Dict[str, Any]) -> User:
    """Creates test admin user with elevated privileges."""
    admin = User(
        id=uuid.uuid4(),
        org_id=test_organization["id"],
        client_id=None,  # System admins don't need client association
        email=f"test.admin.{uuid.uuid4().hex[:8]}@example.com",
        full_name="Test Admin",
        role=UserRole.SYSTEM_ADMIN.value,
        is_active=True
    )
    
    # Set secure admin password
    admin.set_password("AdminPass123!@#")
    
    # Add admin to database
    test_db.add(admin)
    test_db.commit()
    test_db.refresh(admin)
    
    return admin

@pytest.fixture(scope="function")
def api_client(test_user: User) -> TestClient:
    """Creates enhanced FastAPI test client with security and monitoring features."""
    from ..app.main import app  # Lazy import to avoid circular dependencies
    
    # Configure test client with security headers
    client = TestClient(
        app,
        base_url="http://test",
        headers={
            "X-Test-User-ID": str(test_user.id),
            "X-Test-Client-ID": str(test_user.client_id),
            "X-Test-Organization-ID": str(test_user.org_id)
        }
    )
    
    return client

@pytest.fixture(scope="function")
def admin_api_client(test_admin_user: User) -> TestClient:
    """Creates enhanced FastAPI test client with admin privileges."""
    from ..app.main import app
    
    # Configure admin test client
    client = TestClient(
        app,
        base_url="http://test",
        headers={
            "X-Test-User-ID": str(test_admin_user.id),
            "X-Test-Organization-ID": str(test_admin_user.org_id)
        }
    )
    
    return client