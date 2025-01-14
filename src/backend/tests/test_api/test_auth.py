"""
Test suite for authentication endpoints implementing comprehensive testing of OAuth 2.0 
and JWT-based authentication flows with enhanced security validation.

Version: 1.0.0
"""

import pytest
import uuid
from datetime import datetime, timedelta
from faker import Faker  # version: ^19.3.0
import httpx  # version: ^0.24.0
import redis  # version: ^4.6.0
from fastapi_limiter import FastAPILimiter  # version: ^0.1.5
from pythonjsonlogger import jsonlogger  # version: ^2.0.7

from app.models.user import User, UserRole
from app.core.auth import authenticate_user
from app.core.security import create_access_token

# Initialize test components
faker = Faker()
redis_client = redis.Redis(host='localhost', port=6379, db=0)

@pytest.fixture
async def test_tenant():
    """Fixture providing test tenant context."""
    tenant_id = str(uuid.uuid4())
    tenant_name = faker.company()
    
    # Setup tenant context
    tenant_data = {
        'id': tenant_id,
        'name': tenant_name,
        'settings': {
            'features': {'auth': True},
            'preferences': {},
            'limits': {'max_users': 100}
        }
    }
    
    yield tenant_data
    
    # Cleanup tenant data
    await redis_client.delete(f"tenant:{tenant_id}")

@pytest.fixture
async def test_security_context():
    """Fixture providing security testing context."""
    # Configure token blacklist
    await redis_client.flushdb()
    await FastAPILimiter.init(redis_client)
    
    security_context = {
        'rate_limit_key': 'test_auth',
        'max_attempts': 5,
        'window_seconds': 300
    }
    
    yield security_context
    
    # Cleanup security context
    await FastAPILimiter.close()

class TestAuthEndpoints:
    """Test class for authentication endpoints with enhanced security validation."""
    
    def __init__(self):
        """Initialize test class with required test components."""
        self.faker = Faker()
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        
    async def setup_method(self, method):
        """Setup method run before each test with security context."""
        # Reset test data
        await self.redis_client.flushdb()
        
        # Clear token blacklist
        await self.redis_client.delete("token_blacklist:*")
        
        # Setup tenant context
        self.tenant_id = str(uuid.uuid4())
        self.client_id = str(uuid.uuid4())

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_success(self, db_session, test_client):
        """Test successful user login with valid credentials."""
        # Create test user
        email = self.faker.email()
        password = "SecurePass123!"
        user = User(
            id=uuid.uuid4(),
            email=email,
            org_id=self.tenant_id,
            client_id=self.client_id,
            role=UserRole.REGULAR_USER,
            full_name=self.faker.name()
        )
        user.set_password(password)
        db_session.add(user)
        await db_session.commit()

        # Test login request
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": password,
                "tenant_id": str(self.tenant_id)
            }
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "tenant_id" in data

        # Verify audit log
        audit_log = await db_session.execute(
            "SELECT * FROM audit_logs WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1",
            {"user_id": str(user.id)}
        )
        log_entry = audit_log.first()
        assert log_entry.event_type == "login_successful"

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_login_rate_limit(self, test_client, test_security_context):
        """Test rate limiting for login attempts."""
        email = self.faker.email()
        password = "WrongPass123!"
        
        # Exceed rate limit
        for _ in range(test_security_context['max_attempts'] + 1):
            response = await test_client.post(
                "/api/v1/auth/login",
                json={
                    "email": email,
                    "password": password,
                    "tenant_id": str(self.tenant_id)
                }
            )
            
            if _ < test_security_context['max_attempts']:
                assert response.status_code in [401, 404]  # Invalid credentials
            else:
                assert response.status_code == 429  # Rate limit exceeded
                assert "retry-after" in response.headers

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_tenant_isolation(self, db_session, test_client, test_tenant):
        """Test tenant isolation in authentication."""
        # Create users in different tenants
        tenant1_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            org_id=test_tenant['id'],
            role=UserRole.REGULAR_USER,
            full_name=self.faker.name()
        )
        tenant1_user.set_password("SecurePass123!")
        
        tenant2_user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            org_id=str(uuid.uuid4()),  # Different tenant
            role=UserRole.REGULAR_USER,
            full_name=self.faker.name()
        )
        tenant2_user.set_password("SecurePass123!")
        
        db_session.add_all([tenant1_user, tenant2_user])
        await db_session.commit()

        # Test cross-tenant access
        response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": tenant2_user.email,
                "password": "SecurePass123!",
                "tenant_id": str(test_tenant['id'])  # Wrong tenant
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "tenant" in data["detail"].lower()

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_token_validation(self, db_session, test_client, test_tenant):
        """Test JWT token validation and security."""
        # Create test user
        user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            org_id=test_tenant['id'],
            role=UserRole.REGULAR_USER,
            full_name=self.faker.name()
        )
        user.set_password("SecurePass123!")
        db_session.add(user)
        await db_session.commit()

        # Generate valid token
        token_data = {
            "sub": str(user.id),
            "tenant_id": str(test_tenant['id']),
            "role": user.role.value
        }
        access_token = create_access_token(token_data)

        # Test protected endpoint
        response = await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(user.id)
        assert data["tenant_id"] == str(test_tenant['id'])

        # Test expired token
        expired_token = create_access_token(
            token_data,
            expires_delta=timedelta(seconds=-1)
        )
        response = await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.auth
    async def test_logout(self, db_session, test_client, test_security_context):
        """Test user logout and token blacklisting."""
        # Create test user and login
        user = User(
            id=uuid.uuid4(),
            email=self.faker.email(),
            org_id=self.tenant_id,
            role=UserRole.REGULAR_USER,
            full_name=self.faker.name()
        )
        user.set_password("SecurePass123!")
        db_session.add(user)
        await db_session.commit()

        login_response = await test_client.post(
            "/api/v1/auth/login",
            json={
                "email": user.email,
                "password": "SecurePass123!",
                "tenant_id": str(self.tenant_id)
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
        blacklisted = await self.redis_client.get(f"token_blacklist:{token}")
        assert blacklisted is not None

        # Verify token can't be used
        response = await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401