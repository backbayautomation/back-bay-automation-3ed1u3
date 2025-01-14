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
from app.utils.security import SecurityValidator

# Initialize test data generator
faker = Faker()

class ClientTestData:
    """Test data and helper methods for client management tests."""
    
    def __init__(self):
        """Initialize test data generator and test datasets."""
        self.faker = Faker()
        
        # Valid client test data
        self.valid_client_data = {
            'name': self.faker.company(),
            'config': {
                'features': {'search': True, 'export': True},
                'limits': {'max_documents': 1000, 'max_users': 50},
                'preferences': {'theme': 'light'},
                'integrations': {}
            },
            'branding': {
                'colors': {
                    'primary': '#0066CC',
                    'secondary': '#4CAF50',
                    'accent': '#FFC107'
                },
                'logo': None,
                'favicon': None,
                'fonts': {
                    'primary': 'Roboto',
                    'secondary': 'Open Sans'
                }
            }
        }
        
        # Invalid client test data
        self.invalid_client_data = {
            'name': '',  # Empty name
            'config': {'invalid': 'data'},
            'branding': {'colors': {'invalid': 'not-a-color'}}
        }
        
        # Update client test data
        self.update_client_data = {
            'name': self.faker.company(),
            'config': {
                'features': {'search': True, 'export': False},
                'limits': {'max_documents': 500}
            },
            'branding': {
                'colors': {'primary': '#FF0000'}
            }
        }

    async def create_test_client(self, db_session: AsyncSession, tenant_id: uuid.UUID) -> dict:
        """Create a test client with specified configuration."""
        client_data = self.valid_client_data.copy()
        client_data['name'] = self.faker.company()
        client_data['org_id'] = tenant_id
        
        async with db_session.begin():
            client = await db_session.execute(
                """
                INSERT INTO clients (id, org_id, name, config, branding)
                VALUES (:id, :org_id, :name, :config, :branding)
                RETURNING *
                """,
                {
                    'id': uuid.uuid4(),
                    'org_id': tenant_id,
                    'name': client_data['name'],
                    'config': client_data['config'],
                    'branding': client_data['branding']
                }
            )
            return dict(client.first())

@pytest.mark.asyncio
@pytest.mark.clients
async def test_get_clients(
    db_session: AsyncSession,
    auth_headers: dict,
    test_client: AsyncClient
):
    """Test retrieving list of clients with pagination and filtering."""
    # Create test data
    test_data = ClientTestData()
    tenant_id = uuid.uuid4()
    
    # Create multiple test clients
    clients = []
    for _ in range(3):
        client = await test_data.create_test_client(db_session, tenant_id)
        clients.append(client)
    
    # Test pagination
    response = await test_client.get(
        "/api/v1/clients?page=1&page_size=2",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 2
    assert data['total'] == 3
    
    # Test filtering by name
    response = await test_client.get(
        f"/api/v1/clients?name={clients[0]['name']}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 1
    assert data['items'][0]['id'] == str(clients[0]['id'])
    
    # Verify tenant isolation
    other_tenant_response = await test_client.get(
        "/api/v1/clients",
        headers={**auth_headers, 'X-Tenant-ID': str(uuid.uuid4())}
    )
    assert other_tenant_response.status_code == 200
    assert len(other_tenant_response.json()['items']) == 0

@pytest.mark.asyncio
@pytest.mark.clients
async def test_create_client(
    db_session: AsyncSession,
    auth_headers: dict,
    test_client: AsyncClient
):
    """Test client creation with validation and security checks."""
    test_data = ClientTestData()
    
    # Test successful creation
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201
    created_client = response.json()
    assert created_client['name'] == test_data.valid_client_data['name']
    
    # Test duplicate name validation
    duplicate_response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert duplicate_response.status_code == 400
    
    # Test invalid data validation
    invalid_response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.invalid_client_data
    )
    assert invalid_response.status_code == 400

@pytest.mark.asyncio
@pytest.mark.clients
async def test_update_client(
    db_session: AsyncSession,
    auth_headers: dict,
    test_client: AsyncClient
):
    """Test client updates with validation and security checks."""
    test_data = ClientTestData()
    
    # Create test client
    client = await test_data.create_test_client(db_session, uuid.UUID(auth_headers['X-Tenant-ID']))
    
    # Test full update
    response = await test_client.put(
        f"/api/v1/clients/{client['id']}",
        headers=auth_headers,
        json=test_data.update_client_data
    )
    assert response.status_code == 200
    updated_client = response.json()
    assert updated_client['name'] == test_data.update_client_data['name']
    
    # Test partial update
    partial_update = {'config': {'features': {'new_feature': True}}}
    response = await test_client.patch(
        f"/api/v1/clients/{client['id']}",
        headers=auth_headers,
        json=partial_update
    )
    assert response.status_code == 200
    assert response.json()['config']['features']['new_feature'] is True

@pytest.mark.asyncio
@pytest.mark.clients
async def test_delete_client(
    db_session: AsyncSession,
    auth_headers: dict,
    test_client: AsyncClient
):
    """Test client deletion with cascade operations and security checks."""
    test_data = ClientTestData()
    
    # Create test client
    client = await test_data.create_test_client(db_session, uuid.UUID(auth_headers['X-Tenant-ID']))
    
    # Test successful deletion
    response = await test_client.delete(
        f"/api/v1/clients/{client['id']}",
        headers=auth_headers
    )
    assert response.status_code == 204
    
    # Verify client is deleted
    get_response = await test_client.get(
        f"/api/v1/clients/{client['id']}",
        headers=auth_headers
    )
    assert get_response.status_code == 404

@pytest.mark.asyncio
@pytest.mark.clients
@pytest.mark.security
async def test_client_authorization(
    db_session: AsyncSession,
    auth_headers: dict,
    test_client: AsyncClient
):
    """Test role-based access control and security boundaries."""
    test_data = ClientTestData()
    
    # Test ADMIN role access
    admin_headers = {**auth_headers, 'X-User-Role': UserRole.ADMIN.value}
    response = await test_client.post(
        "/api/v1/clients",
        headers=admin_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201
    
    # Test CLIENT_ADMIN role restrictions
    client_admin_headers = {**auth_headers, 'X-User-Role': UserRole.CLIENT_ADMIN.value}
    response = await test_client.post(
        "/api/v1/clients",
        headers=client_admin_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 403
    
    # Test regular user access restrictions
    user_headers = {**auth_headers, 'X-User-Role': UserRole.USER.value}
    response = await test_client.get(
        "/api/v1/clients",
        headers=user_headers
    )
    assert response.status_code == 403