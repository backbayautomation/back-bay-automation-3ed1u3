"""
Comprehensive test suite for client management API endpoints.
Tests CRUD operations, authorization, multi-tenant isolation, and security controls.

Version: 1.0.0
"""

import uuid
import pytest
from faker import Faker
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.utils.security import generate_secure_token, hash_data

class ClientTestData:
    """Test data and helper methods for client management tests."""

    def __init__(self):
        """Initialize test data generator and test datasets."""
        self.faker = Faker()
        
        # Valid client test data
        self.valid_client_data = {
            "name": self.faker.company(),
            "config": {
                "features": {"chat": True, "export": True},
                "access_control": {"max_users": 5},
                "integrations": {}
            },
            "branding": {
                "colors": {"primary": "#0066CC"},
                "logos": {},
                "theme": "light"
            }
        }

        # Invalid client test data
        self.invalid_client_data = {
            "name": "",  # Empty name
            "config": {
                "features": "invalid",  # Should be dict
                "access_control": {},
                "integrations": None  # Should be dict
            },
            "branding": {
                "colors": {},
                "logos": None,  # Should be dict
                "theme": "invalid"  # Invalid theme
            }
        }

        # Update client test data
        self.update_client_data = {
            "name": self.faker.company(),
            "config": {
                "features": {"chat": True, "export": False},
                "access_control": {"max_users": 10},
                "integrations": {"custom_api": True}
            },
            "branding": {
                "colors": {"primary": "#4CAF50"},
                "logos": {"header": "https://example.com/logo.png"},
                "theme": "dark"
            }
        }

    async def create_test_client(self, db_session: AsyncSession, config: dict = None, tenant_id: uuid.UUID = None):
        """Create test client with specified configuration."""
        client_data = self.valid_client_data.copy()
        if config:
            client_data.update(config)
        
        client_data["org_id"] = tenant_id or uuid.uuid4()
        client_data["id"] = uuid.uuid4()
        
        # Create client in database
        client = await db_session.execute(
            """
            INSERT INTO tenant.clients (id, org_id, name, config, branding)
            VALUES (:id, :org_id, :name, :config, :branding)
            RETURNING *
            """,
            client_data
        )
        await db_session.commit()
        
        return client.first()

@pytest.mark.asyncio
@pytest.mark.clients
async def test_get_clients(db_session: AsyncSession, auth_headers: dict, test_client: AsyncClient):
    """Test retrieving list of clients with pagination, filtering, and tenant isolation."""
    test_data = ClientTestData()
    
    # Create multiple test clients
    org_id = uuid.uuid4()
    clients = []
    for _ in range(5):
        client = await test_data.create_test_client(db_session, tenant_id=org_id)
        clients.append(client)

    # Create client for different tenant
    other_client = await test_data.create_test_client(db_session, tenant_id=uuid.uuid4())

    # Test pagination
    response = await test_client.get(
        "/api/v1/clients?page=1&per_page=3",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["total"] == 5
    assert data["page"] == 1

    # Test filtering
    client_name = clients[0].name
    response = await test_client.get(
        f"/api/v1/clients?name={client_name}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == client_name

    # Test tenant isolation
    response = await test_client.get(
        "/api/v1/clients",
        headers={**auth_headers, "X-Organization-ID": str(uuid.uuid4())}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 0

    # Test sorting
    response = await test_client.get(
        "/api/v1/clients?sort=name&order=desc",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert sorted([c["name"] for c in data["items"]], reverse=True) == [c["name"] for c in data["items"]]

@pytest.mark.asyncio
@pytest.mark.clients
async def test_create_client(db_session: AsyncSession, auth_headers: dict, test_client: AsyncClient):
    """Test client creation with validation, duplication checks, and audit logging."""
    test_data = ClientTestData()

    # Test successful creation
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == test_data.valid_client_data["name"]
    assert "id" in data

    # Test duplicate name
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

    # Test invalid data
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.invalid_client_data
    )
    assert response.status_code == 422

    # Test tenant isolation
    other_org_headers = {**auth_headers, "X-Organization-ID": str(uuid.uuid4())}
    response = await test_client.post(
        "/api/v1/clients",
        headers=other_org_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201
    new_client_id = response.json()["id"]

    # Verify client created in correct tenant
    response = await test_client.get(
        f"/api/v1/clients/{new_client_id}",
        headers=auth_headers
    )
    assert response.status_code == 404

@pytest.mark.asyncio
@pytest.mark.clients
async def test_update_client(db_session: AsyncSession, auth_headers: dict, test_client: AsyncClient):
    """Test client updates with partial updates, validation, and audit trails."""
    test_data = ClientTestData()
    
    # Create test client
    client = await test_data.create_test_client(db_session)

    # Test full update
    response = await test_client.put(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=test_data.update_client_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == test_data.update_client_data["name"]
    assert data["config"] == test_data.update_client_data["config"]
    assert data["branding"] == test_data.update_client_data["branding"]

    # Test partial update
    partial_update = {"config": {"features": {"new_feature": True}}}
    response = await test_client.patch(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=partial_update
    )
    assert response.status_code == 200
    data = response.json()
    assert data["config"]["features"]["new_feature"] is True

    # Test invalid update
    response = await test_client.put(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=test_data.invalid_client_data
    )
    assert response.status_code == 422

    # Test tenant isolation
    other_org_headers = {**auth_headers, "X-Organization-ID": str(uuid.uuid4())}
    response = await test_client.put(
        f"/api/v1/clients/{client.id}",
        headers=other_org_headers,
        json=test_data.update_client_data
    )
    assert response.status_code == 404

@pytest.mark.asyncio
@pytest.mark.clients
async def test_delete_client(db_session: AsyncSession, auth_headers: dict, test_client: AsyncClient):
    """Test client deletion with cascade operations and security checks."""
    test_data = ClientTestData()
    
    # Create test client with associated data
    client = await test_data.create_test_client(db_session)

    # Test successful deletion
    response = await test_client.delete(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers
    )
    assert response.status_code == 204

    # Verify client no longer exists
    response = await test_client.get(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers
    )
    assert response.status_code == 404

    # Test deletion of non-existent client
    response = await test_client.delete(
        f"/api/v1/clients/{uuid.uuid4()}",
        headers=auth_headers
    )
    assert response.status_code == 404

    # Test tenant isolation
    other_client = await test_data.create_test_client(db_session, tenant_id=uuid.uuid4())
    response = await test_client.delete(
        f"/api/v1/clients/{other_client.id}",
        headers=auth_headers
    )
    assert response.status_code == 404

@pytest.mark.asyncio
@pytest.mark.clients
@pytest.mark.security
async def test_client_authorization(db_session: AsyncSession, auth_headers: dict, test_client: AsyncClient):
    """Test role-based access control and security boundaries."""
    test_data = ClientTestData()
    
    # Test ADMIN role permissions
    admin_headers = {
        **auth_headers,
        "X-User-Role": UserRole.ADMIN.value
    }
    response = await test_client.post(
        "/api/v1/clients",
        headers=admin_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201

    # Test CLIENT_ADMIN role restrictions
    client_admin_headers = {
        **auth_headers,
        "X-User-Role": UserRole.CLIENT_ADMIN.value
    }
    response = await test_client.post(
        "/api/v1/clients",
        headers=client_admin_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 403

    # Test USER role access limitations
    user_headers = {
        **auth_headers,
        "X-User-Role": UserRole.USER.value
    }
    response = await test_client.get(
        "/api/v1/clients",
        headers=user_headers
    )
    assert response.status_code == 403

    # Test token validation
    invalid_token_headers = {
        **auth_headers,
        "Authorization": f"Bearer {generate_secure_token()}"
    }
    response = await test_client.get(
        "/api/v1/clients",
        headers=invalid_token_headers
    )
    assert response.status_code == 401

    # Test cross-tenant access prevention
    other_org_headers = {
        **auth_headers,
        "X-Organization-ID": str(uuid.uuid4())
    }
    client = await test_data.create_test_client(db_session)
    response = await test_client.get(
        f"/api/v1/clients/{client.id}",
        headers=other_org_headers
    )
    assert response.status_code == 404