"""
Test suite for authentication endpoints implementing comprehensive testing of OAuth 2.0 
and JWT-based authentication flows with enhanced security validation.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
import pytest_asyncio  # version: ^0.21.0
import httpx  # version: ^0.24.0
from faker import Faker  # version: ^19.3.0
from redis import Redis  # version: ^4.6.0
from datetime import datetime, timedelta
import uuid
from python_json_logger import jsonlogger  # version: ^2.0.7
from fastapi_limiter import FastAPILimiter  # version: ^0.1.5

from app.models.user import User
from app.core.auth import authenticate_user
from app.core.security import create_access_token

class TestAuthEndpoints:
    """Test class for authentication endpoints with enhanced security validation."""

    def setup_method(self, method):
        """Setup method run before each test with security context."""
        self.faker = Faker()
        self.redis_client = Redis(
            host='localhost',
            port=6379,
            db=0,
            decode_responses=True
        )
        # Clear rate limit and token blacklist data
        self.redis_client.flushdb()

    def teardown_method(self, method):
        """Cleanup after each test."""
        self.redis_client.close()

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_success(self, db_session, test_client, test_tenant):
        """Test successful user login with valid credentials."""
        # Create test user
        test_password = "Test@Password123"
        test_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            tenant_id=test_tenant.id,
            role="regular_user"
        )
        test_user.set_password(test_password)
        db_session.add(test_user)
        await db_session.commit()

        # Test login request
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": test_password,
                "tenant_id": str(test_tenant.id)
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "tenant_id" in data

        # Verify audit log entry
        audit_log = await db_session.execute(
            "SELECT * FROM audit_logs WHERE user_id = :user_id ORDER BY created_at DESC",
            {"user_id": test_user.id}
        )
        log_entry = audit_log.first()
        assert log_entry.event_type == "auth_successful"

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_rate_limit(self, test_client, test_tenant):
        """Test rate limiting for login attempts."""
        # Setup test data
        test_creds = {
            "email": self.faker.email(),
            "password": "WrongPassword123!",
            "tenant_id": str(test_tenant.id)
        }

        # Exceed rate limit
        for _ in range(6):  # Attempt more than allowed
            await test_client.post("/api/v1/auth/login", json=test_creds)

        # Verify rate limit response
        response = await test_client.post("/api/v1/auth/login", json=test_creds)
        assert response.status_code == 429
        assert "retry-after" in response.headers

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_invalid_credentials(self, db_session, test_client, test_tenant):
        """Test login with invalid credentials."""
        # Create test user
        test_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            tenant_id=test_tenant.id,
            role="regular_user"
        )
        test_user.set_password("ValidPassword123!")
        db_session.add(test_user)
        await db_session.commit()

        # Test with wrong password
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!",
                "tenant_id": str(test_tenant.id)
            }
        )

        assert response.status_code == 401
        assert "failed_login_attempts" in await db_session.get(User, test_user.id).__dict__

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_tenant_isolation(self, db_session, test_client):
        """Test tenant isolation in authentication."""
        # Create two tenants
        tenant1_id = uuid.uuid4()
        tenant2_id = uuid.uuid4()

        # Create user in tenant1
        test_password = "Test@Password123"
        test_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            tenant_id=tenant1_id,
            role="regular_user"
        )
        test_user.set_password(test_password)
        db_session.add(test_user)
        await db_session.commit()

        # Attempt login with wrong tenant
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": test_password,
                "tenant_id": str(tenant2_id)
            }
        )

        assert response.status_code == 401
        assert "Invalid tenant access" in response.json()["detail"]

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_validation(self, db_session, test_client, test_tenant):
        """Test JWT token validation and security."""
        # Create test user
        test_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            tenant_id=test_tenant.id,
            role="regular_user"
        )
        db_session.add(test_user)
        await db_session.commit()

        # Create valid token
        valid_token = create_access_token(
            data={"sub": str(test_user.id)},
            expires_delta=timedelta(minutes=30)
        )

        # Test protected endpoint
        response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {valid_token}"}
        )
        assert response.status_code == 200

        # Test expired token
        expired_token = create_access_token(
            data={"sub": str(test_user.id)},
            expires_delta=timedelta(minutes=-30)
        )
        response = await test_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_logout(self, db_session, test_client, test_tenant):
        """Test user logout and token blacklisting."""
        # Create test user and login
        test_password = "Test@Password123"
        test_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            tenant_id=test_tenant.id,
            role="regular_user"
        )
        test_user.set_password(test_password)
        db_session.add(test_user)
        await db_session.commit()

        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": test_password,
                "tenant_id": str(test_tenant.id)
            }
        )
        token = login_response.json()["access_token"]

        # Test logout
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
    return type('Tenant', (), {
        'id': uuid.uuid4(),
        'name': 'Test Tenant'
    })

@pytest.fixture
async def test_security_context(redis_client):
    """Fixture providing security testing context."""
    # Configure rate limiter
    await FastAPILimiter.init(redis_client)
    
    # Setup security logging
    logger = jsonlogger.JsonFormatter()
    
    yield {
        'rate_limiter': FastAPILimiter,
        'logger': logger
    }
    
    # Cleanup
    await FastAPILimiter.close()