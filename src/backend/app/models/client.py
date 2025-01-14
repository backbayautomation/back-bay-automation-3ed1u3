from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, JSON, DateTime, UUID, ForeignKey, Index
from sqlalchemy.orm import relationship, validates

# Import organization model for relationship
from app.models.organization import Base

class Client(Base):
    """
    SQLAlchemy model representing a client in the multi-tenant system.
    Implements comprehensive client data management with secure multi-tenant isolation,
    configuration management, and relationship handling with robust audit capabilities.
    """
    __tablename__ = 'clients'
    
    # Define composite indexes for efficient querying
    __table_args__ = (
        Index('ix_clients_org_id_name', 'org_id', 'name'),
        Index('ix_clients_updated_at', 'updated_at')
    )

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4)
    
    # Organization foreign key for tenant isolation with cascading delete
    org_id = Column(
        UUID, 
        ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # Client name with indexing for efficient queries
    name = Column(String(100), nullable=False, index=True)
    
    # JSON fields for flexible configuration and branding management
    config = Column(
        JSON,
        nullable=False,
        default={
            'features': {},
            'limits': {},
            'preferences': {},
            'integrations': {}
        }
    )
    
    branding = Column(
        JSON,
        nullable=False,
        default={
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
    )
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships with lazy loading and cascading delete
    organization = relationship(
        'Organization',
        back_populates='clients',
        lazy='select'
    )
    
    documents = relationship(
        'Document',
        back_populates='client',
        cascade='all, delete-orphan',
        lazy='select'
    )
    
    users = relationship(
        'User',
        back_populates='client',
        cascade='all, delete-orphan',
        lazy='select'
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
            'organization': self.organization.name if self.organization else None,
            'document_count': len(self.documents) if self.documents else 0,
            'user_count': len(self.users) if self.users else 0
        }

    def update_config(self, new_config):
        """
        Update client configuration with validation.
        
        Args:
            new_config (dict): New configuration dictionary to merge
            
        Raises:
            ValueError: If configuration validation fails
        """
        # Validate new configuration
        self.validate_config(new_config)
        
        # Merge with existing config
        self.config.update(new_config)
        self.updated_at = datetime.utcnow()

    def update_branding(self, new_branding):
        """
        Update client branding settings with validation.
        
        Args:
            new_branding (dict): New branding dictionary to merge
            
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

        required_keys = {'features', 'limits', 'preferences', 'integrations'}
        if not all(key in config for key in required_keys):
            raise ValueError(f"Configuration must contain all required keys: {required_keys}")

        # Validate configuration structure
        if not all(isinstance(config.get(key), dict) for key in required_keys):
            raise ValueError("All configuration sections must be dictionaries")

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

        required_keys = {'colors', 'logo', 'favicon', 'fonts'}
        if not all(key in branding for key in required_keys):
            raise ValueError(f"Branding must contain all required keys: {required_keys}")

        # Validate colors
        colors = branding.get('colors', {})
        if not isinstance(colors, dict) or not all(
            isinstance(color, str) and color.startswith('#')
            for color in colors.values()
        ):
            raise ValueError("Invalid color format in branding")

        # Validate fonts
        fonts = branding.get('fonts', {})
        if not isinstance(fonts, dict) or not all(
            isinstance(font, str) for font in fonts.values()
        ):
            raise ValueError("Invalid font format in branding")

        return branding

    def __repr__(self):
        """
        String representation of the Client instance.
        
        Returns:
            str: Formatted string with client name and ID
        """
        return f"Client(name='{self.name}', id='{self.id}')"