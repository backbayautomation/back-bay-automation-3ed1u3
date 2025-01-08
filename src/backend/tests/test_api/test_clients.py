"""
Comprehensive test suite for client management API endpoints.
Tests CRUD operations, authorization, multi-tenant isolation, and security controls.

Version: 1.0.0
"""

import uuid
import pytest
from datetime import datetime, timedelta
from faker import Faker
from httpx import AsyncClient

from app.models.user import UserRole
from app.utils.security import SecurityValidator

class ClientTestData:
    """Test data generator and helper methods for client management tests."""

    def __init__(self):
        """Initialize test data generator with Faker instance."""
        self.faker = Faker()
        
        # Valid client test data
        self.valid_client_data = {
            'name': self.faker.company(),
            'config': {
                'features': {'chat': True, 'export': True},
                'access_control': {'max_users': 10},
                'integration_settings': {},
                'notification_preferences': {'email': True}
            },
            'branding': {
                'theme': {
                    'primary_color': '#0066CC',
                    'secondary_color': '#4CAF50',
                    'font_family': 'Roboto'
                },
                'logo_url': 'https://example.com/logo.png',
                'favicon_url': 'https://example.com/favicon.ico'
            }
        }

        # Invalid client test data
        self.invalid_client_data = {
            'name': '',  # Empty name
            'config': {
                'features': 'invalid',  # Should be dict
                'access_control': {},
                'integration_settings': None,  # Invalid type
                'notification_preferences': []  # Invalid type
            },
            'branding': {
                'theme': {
                    'primary_color': 'invalid-color',
                    'secondary_color': 123,  # Invalid type
                    'font_family': None  # Invalid type
                }
            }
        }

        # Update client test data
        self.update_client_data = {
            'name': self.faker.company(),
            'config': {
                'features': {'chat': False, 'export': True},
                'access_control': {'max_users': 20}
            },
            'branding': {
                'theme': {
                    'primary_color': '#FF0000',
                    'secondary_color': '#00FF00'
                }
            }
        }

    async def create_test_client(self, db_session, tenant_id=None, config=None):
        """Create test client with specified configuration."""
        client_data = self.valid_client_data.copy()
        if config:
            client_data.update(config)
        
        client_data['org_id'] = tenant_id or uuid.uuid4()
        client = Client(**client_data)
        db_session.add(client)
        await db_session.commit()
        await db_session.refresh(client)
        return client

@pytest.mark.asyncio
@pytest.mark.clients
async def test_get_clients(db_session, auth_headers, test_client):
    """Test retrieving list of clients with pagination and filtering."""
    # Create test data
    test_data = ClientTestData()
    tenant_id = uuid.uuid4()
    clients = []
    
    # Create multiple test clients
    for _ in range(5):
        client = await test_data.create_test_client(db_session, tenant_id)
        clients.append(client)

    # Test pagination
    response = await test_client.get(
        "/api/v1/clients?page=1&size=2",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 2
    assert data['total'] == 5
    assert data['page'] == 1

    # Test filtering by name
    client_name = clients[0].name
    response = await test_client.get(
        f"/api/v1/clients?name={client_name}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 1
    assert data['items'][0]['name'] == client_name

    # Test tenant isolation
    other_tenant_client = await test_data.create_test_client(
        db_session, 
        uuid.uuid4()  # Different tenant
    )
    response = await test_client.get("/api/v1/clients", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    client_ids = [item['id'] for item in data['items']]
    assert str(other_tenant_client.id) not in client_ids

@pytest.mark.asyncio
@pytest.mark.clients
async def test_create_client(db_session, auth_headers, test_client):
    """Test client creation with validation and security checks."""
    test_data = ClientTestData()

    # Test successful creation
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 201
    data = response.json()
    assert data['name'] == test_data.valid_client_data['name']
    assert 'id' in data

    # Test duplicate name validation
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 400
    assert 'duplicate' in response.json()['detail'].lower()

    # Test invalid data validation
    response = await test_client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json=test_data.invalid_client_data
    )
    assert response.status_code == 400
    errors = response.json()['detail']
    assert 'name' in errors
    assert 'config' in errors

@pytest.mark.asyncio
@pytest.mark.clients
async def test_update_client(db_session, auth_headers, test_client):
    """Test client updates with validation and audit logging."""
    test_data = ClientTestData()
    client = await test_data.create_test_client(db_session)

    # Test full update
    response = await test_client.put(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=test_data.update_client_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data['name'] == test_data.update_client_data['name']
    assert data['config']['features']['chat'] == False

    # Test partial update
    partial_update = {'config': {'features': {'chat': True}}}
    response = await test_client.patch(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=partial_update
    )
    assert response.status_code == 200
    data = response.json()
    assert data['config']['features']['chat'] == True

    # Test update with invalid data
    response = await test_client.put(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers,
        json=test_data.invalid_client_data
    )
    assert response.status_code == 400

@pytest.mark.asyncio
@pytest.mark.clients
async def test_delete_client(db_session, auth_headers, test_client):
    """Test client deletion with cascade operations."""
    test_data = ClientTestData()
    client = await test_data.create_test_client(db_session)

    # Test successful deletion
    response = await test_client.delete(
        f"/api/v1/clients/{client.id}",
        headers=auth_headers
    )
    assert response.status_code == 204

    # Verify client is deleted
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

@pytest.mark.asyncio
@pytest.mark.clients
@pytest.mark.security
async def test_client_authorization(db_session, auth_headers, test_client):
    """Test role-based access control for client operations."""
    test_data = ClientTestData()
    client = await test_data.create_test_client(db_session)

    # Test ADMIN role access
    admin_headers = auth_headers.copy()
    admin_headers['X-User-Role'] = UserRole.ADMIN.value
    response = await test_client.get(
        "/api/v1/clients",
        headers=admin_headers
    )
    assert response.status_code == 200

    # Test CLIENT_ADMIN role restrictions
    client_admin_headers = auth_headers.copy()
    client_admin_headers['X-User-Role'] = UserRole.CLIENT_ADMIN.value
    response = await test_client.get(
        "/api/v1/clients",
        headers=client_admin_headers
    )
    assert response.status_code == 200
    # Verify only own client is visible
    data = response.json()
    assert len(data['items']) == 1

    # Test regular user access restrictions
    user_headers = auth_headers.copy()
    user_headers['X-User-Role'] = UserRole.USER.value
    response = await test_client.post(
        "/api/v1/clients",
        headers=user_headers,
        json=test_data.valid_client_data
    )
    assert response.status_code == 403

    # Test cross-tenant access prevention
    other_tenant_headers = auth_headers.copy()
    other_tenant_headers['X-Tenant-ID'] = str(uuid.uuid4())
    response = await test_client.get(
        f"/api/v1/clients/{client.id}",
        headers=other_tenant_headers
    )
    assert response.status_code == 403