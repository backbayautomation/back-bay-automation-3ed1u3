"""
Pytest configuration module providing comprehensive test fixtures for database sessions,
authentication, multi-tenant isolation, and test data management.

Version: 1.0.0
"""

import logging
import uuid
from typing import Generator, Dict, Any
import pytest
from fastapi.testclient import TestClient  # version: 0.100.0
from sqlalchemy import create_engine, event  # version: 2.0.0
from sqlalchemy.orm import Session, sessionmaker  # version: 2.0.0

from ..app.db.session import Base, SessionLocal
from ..app.core.config import settings
from ..app.models.user import User
from ..app.core.security import get_password_hash, create_access_token

# Configure test logger
logger = logging.getLogger(__name__)

@pytest.fixture(scope="session")
def test_db_engine():
    """Create test database engine with enhanced monitoring and isolation."""
    # Get test database settings
    db_settings = settings.get_database_settings()
    
    # Create test database URL with unique test database
    test_db_url = (
        f"postgresql://{db_settings['username']}:{db_settings['password']}@"
        f"{db_settings['host']}:{db_settings['port']}/test_catalog_search_{uuid.uuid4()}"
    )
    
    # Create engine with optimized test settings
    engine = create_engine(
        test_db_url,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True,
        connect_args={'connect_timeout': 5}
    )
    
    # Set up query logging for debugging
    @event.listens_for(engine, 'before_cursor_execute')
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault('query_start_time', []).append(logger.debug(
            "Test database query starting",
            extra={
                'statement': statement,
                'parameters': parameters
            }
        ))

    @event.listens_for(engine, 'after_cursor_execute')
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        logger.debug(
            "Test database query completed",
            extra={
                'statement': statement,
                'parameters': parameters
            }
        )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup: Drop all tables
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_db(test_db_engine) -> Generator[Session, None, None]:
    """
    Create test database session with enhanced isolation and monitoring.
    
    Yields:
        SQLAlchemy session for test database with transaction isolation
    """
    # Create test session factory
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_db_engine,
        expire_on_commit=False
    )
    
    # Create new session
    session = TestingSessionLocal()
    
    try:
        # Set isolation level for test
        session.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        
        logger.debug("Test database session created")
        
        yield session
        
        # Rollback after each test
        session.rollback()
        
    except Exception as e:
        logger.error(
            "Test database session error",
            extra={'error': str(e)}
        )
        raise
        
    finally:
        session.close()
        logger.debug("Test database session closed")

@pytest.fixture(scope="function")
def test_user(test_db: Session) -> User:
    """
    Create test user with comprehensive role and tenant configuration.
    
    Args:
        test_db: Test database session
        
    Returns:
        Created test user instance with full configuration
    """
    # Generate unique test data
    test_tenant_id = uuid.uuid4()
    test_email = f"test.user_{uuid.uuid4()}@example.com"
    
    # Create test user
    user = User(
        id=uuid.uuid4(),
        email=test_email,
        full_name="Test User",
        role="regular_user",
        org_id=test_tenant_id,
        client_id=test_tenant_id,
        is_active=True
    )
    
    # Set secure password
    user.hashed_password = get_password_hash("Test@Password123!")
    
    # Add to database
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    
    logger.info(
        "Test user created",
        extra={
            'user_id': str(user.id),
            'tenant_id': str(test_tenant_id)
        }
    )
    
    return user

@pytest.fixture(scope="function")
def test_client(test_user: User) -> TestClient:
    """
    Create enhanced FastAPI test client with security and monitoring features.
    
    Args:
        test_user: Test user instance
        
    Returns:
        Configured FastAPI test client with security features
    """
    # Create access token for test user
    access_token = create_access_token(
        data={
            "sub": test_user.email,
            "tenant_id": str(test_user.client_id),
            "role": test_user.role
        }
    )
    
    # Configure test client with security headers
    client = TestClient(
        app,
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Tenant-ID": str(test_user.client_id)
        }
    )
    
    # Add test client logging
    @client.middleware("http")
    async def log_requests(request, call_next):
        logger.debug(
            "Test client request",
            extra={
                'method': request.method,
                'url': str(request.url),
                'headers': dict(request.headers)
            }
        )
        response = await call_next(request)
        logger.debug(
            "Test client response",
            extra={
                'status_code': response.status_code
            }
        )
        return response
    
    return client

@pytest.fixture(scope="function")
def test_tenant_context(test_user: User) -> Dict[str, Any]:
    """
    Create isolated tenant context for multi-tenant testing.
    
    Args:
        test_user: Test user instance
        
    Returns:
        Dict containing tenant context information
    """
    return {
        "tenant_id": str(test_user.client_id),
        "org_id": str(test_user.org_id),
        "user_id": str(test_user.id),
        "role": test_user.role
    }