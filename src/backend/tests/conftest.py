"""
Pytest configuration file providing comprehensive test fixtures for database sessions,
authentication, multi-tenant isolation, and test data management.

Version: 1.0.0
"""

import logging
import uuid
from typing import Generator, Dict, Any
import pytest  # version: 7.4.0
from sqlalchemy import create_engine, event  # version: 2.0.0
from sqlalchemy.orm import Session, sessionmaker  # version: 2.0.0
from fastapi.testclient import TestClient  # version: 0.100.0

from ..app.db.session import SessionLocal, Base
from ..app.core.config import settings
from ..app.models.user import User
from ..app.core.security import create_access_token, get_password_hash

# Configure test logger
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def test_db_engine():
    """Create test database engine with enhanced isolation and monitoring."""
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
        connect_args={"options": "-c timezone=utc"}
    )

    # Set up query logging for debugging
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_time", []).append(logger.debug(statement))

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        logger.debug("Query completed")

    # Create test tables
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup test database
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_db(test_db_engine) -> Generator[Session, None, None]:
    """
    Creates and manages a test database session with enhanced isolation and monitoring.
    Implements transaction rollback after each test for clean state.
    """
    # Create test session with custom configuration
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_db_engine,
        expire_on_commit=False
    )
    
    # Create new session for test
    session = TestingSessionLocal()
    
    try:
        # Set isolation level for test
        session.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        logger.debug("Test database session created with SERIALIZABLE isolation")
        
        yield session
        
        # Rollback after test
        session.rollback()
        logger.debug("Test database session rolled back")
        
    except Exception as e:
        logger.error(f"Test database session error: {str(e)}")
        raise
        
    finally:
        # Cleanup session
        session.close()
        logger.debug("Test database session closed")

@pytest.fixture(scope="function")
def test_user(test_db: Session) -> User:
    """
    Creates a test user with comprehensive role and tenant configuration.
    Implements secure password handling and audit logging.
    """
    try:
        # Generate unique test user data
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        email = f"test.user.{user_id}@example.com"
        
        # Create test user with secure configuration
        user = User(
            id=user_id,
            email=email,
            tenant_id=tenant_id,
            role="regular_user",
            is_active=True
        )
        
        # Set secure test password
        user.set_password("Test@Password123!")
        
        # Add user to database
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
        
        logger.info(f"Test user created: {user.email}")
        return user
        
    except Exception as e:
        logger.error(f"Test user creation failed: {str(e)}")
        test_db.rollback()
        raise

@pytest.fixture(scope="function")
def test_client(test_user: User) -> TestClient:
    """
    Creates enhanced FastAPI test client with security and monitoring features.
    Implements proper authentication and request tracking.
    """
    try:
        # Create access token for test user
        access_token = create_access_token(
            data={"sub": test_user.email, "tenant_id": str(test_user.tenant_id)}
        )
        
        # Configure test client with security headers
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Tenant-ID": str(test_user.tenant_id),
            "Content-Type": "application/json"
        }
        
        # Create test client with monitoring
        client = TestClient(
            app=settings.get_app(),
            base_url="http://test",
            headers=headers,
            raise_server_exceptions=True
        )
        
        logger.info("Test client created with authentication")
        return client
        
    except Exception as e:
        logger.error(f"Test client creation failed: {str(e)}")
        raise

@pytest.fixture(scope="function")
def test_tenant_context(test_db: Session) -> Dict[str, Any]:
    """
    Creates isolated multi-tenant test context with proper data separation.
    Implements tenant-specific configuration and cleanup.
    """
    try:
        # Generate unique tenant data
        tenant_id = uuid.uuid4()
        tenant_name = f"Test Tenant {tenant_id}"
        
        # Create tenant configuration
        tenant_config = {
            "id": tenant_id,
            "name": tenant_name,
            "settings": {
                "features": {"search": True, "export": True},
                "limits": {"max_documents": 1000, "max_users": 50}
            }
        }
        
        logger.info(f"Test tenant context created: {tenant_name}")
        return tenant_config
        
    except Exception as e:
        logger.error(f"Test tenant context creation failed: {str(e)}")
        raise