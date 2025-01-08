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
    org_id = Column(UUID, ForeignKey('organizations.id', ondelete='CASCADE'), 
                   nullable=False, index=True,
                   doc="Organization ID for tenant isolation")
    name = Column(String(100), nullable=False, index=True,
                 doc="Client's business name")

    # Configuration Fields
    config = Column(JSON, nullable=False, default={
        'features': {},
        'access_control': {},
        'integration_settings': {},
        'notification_preferences': {}
    }, doc="Client-specific configuration settings")

    branding = Column(JSON, nullable=False, default={
        'theme': {
            'primary_color': '#0066CC',
            'secondary_color': '#4CAF50',
            'font_family': 'Roboto'
        },
        'logo_url': None,
        'favicon_url': None
    }, doc="Client branding and customization settings")

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
                        doc="Users belonging to this client")

    # Indexes for query optimization
    __table_args__ = (
        Index('ix_clients_org_id_name', 'org_id', 'name'),
        Index('ix_clients_updated_at', 'updated_at'),
        {'extend_existing': True}
    )

    def to_dict(self):
        """
        Convert client model to dictionary representation with all relationships.

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
            'organization': self.organization.name if self.organization else None,
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
    def validate_config(self, config):
        """
        Validate client configuration schema.

        Args:
            config (dict): Configuration dictionary to validate

        Returns:
            dict: Validated configuration dictionary

        Raises:
            ValueError: If configuration validation fails
        """
        if not isinstance(config, dict):
            raise ValueError("Configuration must be a dictionary")

        required_keys = {'features', 'access_control', 
                        'integration_settings', 'notification_preferences'}
        if not all(key in config for key in required_keys):
            raise ValueError(f"Configuration must contain all required keys: {required_keys}")

        # Validate features
        if not isinstance(config['features'], dict):
            raise ValueError("Features must be a dictionary")

        # Validate access control
        if not isinstance(config['access_control'], dict):
            raise ValueError("Access control must be a dictionary")

        # Validate integration settings
        if not isinstance(config['integration_settings'], dict):
            raise ValueError("Integration settings must be a dictionary")

        # Validate notification preferences
        if not isinstance(config['notification_preferences'], dict):
            raise ValueError("Notification preferences must be a dictionary")

        return config

    @validates('branding')
    def validate_branding(self, branding):
        """
        Validate client branding schema.

        Args:
            branding (dict): Branding dictionary to validate

        Returns:
            dict: Validated branding dictionary

        Raises:
            ValueError: If branding validation fails
        """
        if not isinstance(branding, dict):
            raise ValueError("Branding must be a dictionary")

        if 'theme' not in branding:
            raise ValueError("Branding must contain theme settings")

        theme = branding['theme']
        if not isinstance(theme, dict):
            raise ValueError("Theme must be a dictionary")

        # Validate color codes
        for color_key in ['primary_color', 'secondary_color']:
            if color_key in theme:
                color = theme[color_key]
                if not isinstance(color, str) or not color.startswith('#'):
                    raise ValueError(f"Invalid color format for {color_key}")

        # Validate URLs
        for url_key in ['logo_url', 'favicon_url']:
            if url_key in branding and branding[url_key] is not None:
                url = branding[url_key]
                if not isinstance(url, str) or not (url.startswith('http://') or 
                                                  url.startswith('https://')):
                    raise ValueError(f"Invalid URL format for {url_key}")

        return branding

    def __repr__(self):
        """
        String representation of the Client instance.

        Returns:
            str: Formatted string with client name and ID
        """
        return f"<Client(name='{self.name}', id='{self.id}')>"