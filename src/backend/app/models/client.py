from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, JSON, DateTime, UUID, ForeignKey, Index
from sqlalchemy.orm import relationship, validates

from app.models.organization import Base

class Client(Base):
    """
    SQLAlchemy model representing a client in the multi-tenant system.
    Implements comprehensive client data management with secure multi-tenant isolation,
    configuration management, and relationship handling with robust audit capabilities.
    """
    __tablename__ = 'clients'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4, 
                doc="Unique identifier for the client")
    org_id = Column(UUID, ForeignKey('tenant.organizations.id', ondelete='CASCADE'), 
                   nullable=False, index=True,
                   doc="Organization ID for tenant isolation")
    name = Column(String(100), nullable=False, index=True,
                 doc="Client's business name")

    # Configuration Fields
    config = Column(JSON, nullable=False, 
                   default={'features': {}, 'access_control': {}, 'integrations': {}},
                   doc="Client-specific configuration settings")
    branding = Column(JSON, nullable=False,
                     default={'colors': {}, 'logos': {}, 'theme': 'light'},
                     doc="Client portal branding configuration")

    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of client creation")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       onupdate=datetime.utcnow,
                       doc="Timestamp of last client update")

    # Relationships
    organization = relationship('Organization', back_populates='clients', lazy='select',
                              doc="Parent organization relationship")
    documents = relationship('Document', back_populates='client',
                           cascade='all, delete-orphan', lazy='select',
                           doc="Associated documents for this client")
    users = relationship('User', back_populates='client',
                        cascade='all, delete-orphan', lazy='select',
                        doc="Users associated with this client")

    # Indexes for query optimization
    __table_args__ = (
        Index('ix_clients_org_id_name', 'org_id', 'name'),
        Index('ix_clients_updated_at', 'updated_at'),
        {'schema': 'tenant'}
    )

    def to_dict(self):
        """
        Convert client model to dictionary representation with relationships.

        Returns:
            dict: Comprehensive client data dictionary including relationships
        """
        return {
            'id': str(self.id),
            'org_id': str(self.org_id),
            'name': self.name,
            'config': self.config,
            'branding': self.branding,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'organization_name': self.organization.name if self.organization else None,
            'document_count': len(self.documents) if self.documents else 0,
            'user_count': len(self.users) if self.users else 0
        }

    def update_config(self, new_config):
        """
        Update client configuration with validation.

        Args:
            new_config (dict): New configuration settings to apply

        Raises:
            ValueError: If configuration validation fails
        """
        # Validate new configuration
        self.validate_config(new_config)
        
        # Merge with existing configuration
        self.config.update(new_config)
        self.updated_at = datetime.utcnow()

    def update_branding(self, new_branding):
        """
        Update client branding settings with validation.

        Args:
            new_branding (dict): New branding settings to apply

        Raises:
            ValueError: If branding validation fails
        """
        # Validate new branding
        self.validate_branding(new_branding)
        
        # Merge with existing branding
        self.branding.update(new_branding)
        self.updated_at = datetime.utcnow()

    @validates('config')
    def validate_config(self, key, config):
        """
        Validate client configuration schema.

        Args:
            key (str): Field name being validated
            config (dict): Configuration to validate

        Returns:
            dict: Validated configuration dictionary

        Raises:
            ValueError: If configuration validation fails
        """
        if not isinstance(config, dict):
            raise ValueError("Configuration must be a dictionary")

        required_keys = {'features', 'access_control', 'integrations'}
        if not all(key in config for key in required_keys):
            raise ValueError(f"Configuration must contain all required keys: {required_keys}")

        # Validate features configuration
        if not isinstance(config['features'], dict):
            raise ValueError("Features configuration must be a dictionary")

        # Validate access control settings
        if not isinstance(config['access_control'], dict):
            raise ValueError("Access control configuration must be a dictionary")

        # Validate integrations configuration
        if not isinstance(config['integrations'], dict):
            raise ValueError("Integrations configuration must be a dictionary")

        return config

    @validates('branding')
    def validate_branding(self, key, branding):
        """
        Validate client branding schema.

        Args:
            key (str): Field name being validated
            branding (dict): Branding settings to validate

        Returns:
            dict: Validated branding dictionary

        Raises:
            ValueError: If branding validation fails
        """
        if not isinstance(branding, dict):
            raise ValueError("Branding must be a dictionary")

        required_keys = {'colors', 'logos', 'theme'}
        if not all(key in branding for key in required_keys):
            raise ValueError(f"Branding must contain all required keys: {required_keys}")

        # Validate color codes
        if not isinstance(branding['colors'], dict):
            raise ValueError("Colors must be a dictionary")
        
        # Validate logo URLs
        if not isinstance(branding['logos'], dict):
            raise ValueError("Logos must be a dictionary")

        # Validate theme setting
        if branding['theme'] not in {'light', 'dark', 'custom'}:
            raise ValueError("Theme must be one of: light, dark, custom")

        return branding

    @validates('name')
    def validate_name(self, key, name):
        """
        Validate client name.

        Args:
            key (str): Field name being validated
            name (str): Client name to validate

        Returns:
            str: Validated client name

        Raises:
            ValueError: If name validation fails
        """
        if not name or not isinstance(name, str):
            raise ValueError("Client name must be a non-empty string")

        if not 2 <= len(name) <= 100:
            raise ValueError("Client name must be between 2 and 100 characters")

        # Check for valid characters
        if not all(c.isalnum() or c.isspace() or c in '.-_&' for c in name):
            raise ValueError("Client name contains invalid characters")

        return name.strip()

    def __repr__(self):
        """
        String representation of the Client instance.

        Returns:
            str: Formatted string with client name and ID
        """
        return f"<Client(name='{self.name}', id='{self.id}')>"