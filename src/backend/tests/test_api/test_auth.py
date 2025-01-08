"""
Test suite for authentication endpoints implementing comprehensive testing of OAuth 2.0 
and JWT-based authentication flows, including login, logout, user session management, 
rate limiting, tenant isolation, and security audit logging.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
import pytest_asyncio  # version: 0.21.0
import httpx  # version: 0.24.0
from faker import Faker  # version: 19.3.0
import redis  # version: 4.6.0
from python_json_logger import jsonlogger  # version: 2.0.7
from fastapi_limiter import FastAPILimiter  # version: 0.1.5
from datetime import datetime, timedelta
from uuid import uuid4

from app.models.user import User
from app.core.auth import authenticate_user
from app.core.security import create_access_token

# Initialize test components
faker = Faker()

class TestAuthEndpoints:
    """Test class for authentication endpoints with enhanced security validation."""

    def setup_method(self):
        """Setup method run before each test with security context."""
        # Initialize Redis for rate limiting and token blacklist
        self.redis_client = redis.Redis(
            host='localhost',
            port=6379,
            db=0,
            decode_responses=True
        )
        self.redis_client.flushall()

        # Initialize test data
        self.test_password = "Test@123456"
        self.test_email = faker.email()

    async def create_test_user(self, db_session, tenant_id=None, role="regular_user"):
        """Helper method to create test user with security context."""
        user = User(
            id=uuid4(),
            email=self.test_email,
            org_id=tenant_id or uuid4(),
            role=role,
            full_name=faker.name(),
            is_active=True
        )
        user.set_password(self.test_password)
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_success(self, db_session, test_client):
        """Test successful user login with valid credentials."""
        # Create test user
        tenant_id = uuid4()
        user = await self.create_test_user(db_session, tenant_id)

        # Test login
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "tenant_id": str(tenant_id)
            }
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "tenant_id" in data

        # Verify audit log
        audit_logs = await db_session.execute(
            "SELECT * FROM audit_logs WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1",
            {"user_id": str(user.id)}
        )
        log = audit_logs.first()
        assert log.event_type == "auth_successful_login"

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_invalid_credentials(self, db_session, test_client):
        """Test login with invalid credentials."""
        tenant_id = uuid4()
        await self.create_test_user(db_session, tenant_id)

        # Test with wrong password
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_email,
                "password": "WrongPassword@123",
                "tenant_id": str(tenant_id)
            }
        )

        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_rate_limit(self, test_client):
        """Test rate limiting for login attempts."""
        tenant_id = str(uuid4())
        
        # Exceed rate limit
        for _ in range(6):
            await test_client.post(
                "/api/v1/auth/login",
                json={
                    "email": self.test_email,
                    "password": self.test_password,
                    "tenant_id": tenant_id
                }
            )

        # Verify rate limit response
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "tenant_id": tenant_id
            }
        )

        assert response.status_code == 429
        assert "Too many authentication attempts" in response.json()["detail"]
        assert "Retry-After" in response.headers

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_tenant_isolation(self, db_session, test_client):
        """Test tenant isolation in authentication."""
        # Create users in different tenants
        tenant_1 = uuid4()
        tenant_2 = uuid4()
        user_1 = await self.create_test_user(db_session, tenant_1)
        
        # Attempt cross-tenant access
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "tenant_id": str(tenant_2)
            }
        )

        assert response.status_code == 401
        assert "Invalid tenant context" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_validation(self, db_session, test_client):
        """Test JWT token validation and security."""
        tenant_id = uuid4()
        user = await self.create_test_user(db_session, tenant_id)

        # Generate valid token
        token = create_access_token(
            data={"sub": str(user.id), "tenant_id": str(tenant_id)},
            expires_delta=timedelta(minutes=30)
        )

        # Test protected endpoint
        response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert response.json()["email"] == self.test_email

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_expiration(self, db_session, test_client):
        """Test token expiration handling."""
        tenant_id = uuid4()
        user = await self.create_test_user(db_session, tenant_id)

        # Generate expired token
        token = create_access_token(
            data={"sub": str(user.id), "tenant_id": str(tenant_id)},
            expires_delta=timedelta(seconds=-1)
        )

        response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 401
        assert "Token has expired" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_logout(self, db_session, test_client):
        """Test user logout and token blacklisting."""
        tenant_id = uuid4()
        user = await self.create_test_user(db_session, tenant_id)

        # Login to get token
        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "tenant_id": str(tenant_id)
            }
        )
        token = login_response.json()["access_token"]

        # Logout
        response = await test_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200

        # Verify token is blacklisted
        response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401

@pytest.fixture
async def test_tenant():
    """Fixture providing test tenant context."""
    tenant_id = uuid4()
    yield tenant_id

@pytest.fixture
async def test_security_context(redis_client):
    """Fixture providing security testing context."""
    # Configure rate limiter
    await FastAPILimiter.init(redis_client)
    
    # Clear token blacklist
    redis_client.delete("token_blacklist")
    
    yield
    
    # Cleanup
    await FastAPILimiter.close()