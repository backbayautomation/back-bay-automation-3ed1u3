from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, JSON, DateTime, UUID, MetaData, Index
from sqlalchemy.orm import declarative_base, relationship, validates

# Define base with tenant schema for multi-tenant isolation
Base = declarative_base(metadata=MetaData(schema='tenant'))

class Organization(Base):
    """
    SQLAlchemy model representing an organization in the multi-tenant system.
    Implements comprehensive tenant isolation, data partitioning, and relationship management
    with robust security controls and audit capabilities.
    """
    __tablename__ = 'organizations'

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4, index=True)
    
    # Organization name with uniqueness constraint and indexing for efficient queries
    name = Column(String(100), nullable=False, index=True, unique=True)
    
    # JSON settings for flexible configuration management
    settings = Column(
        JSON, 
        nullable=False,
        default={'features': {}, 'preferences': {}, 'limits': {}}
    )
    
    # Audit timestamps with indexing for efficient filtering and reporting
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(
        DateTime, 
        nullable=False, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        index=True
    )
    
    # Relationship to clients with cascading delete and ordered retrieval
    clients = relationship(
        'Client',
        back_populates='organization',
        cascade='all, delete-orphan',
        lazy='select',
        order_by='Client.name'
    )

    def __repr__(self):
        """
        String representation of the Organization instance.
        
        Returns:
            str: Formatted string containing organization name and ID
        """
        return f"Organization(name='{self.name}', id='{self.id}')"

    @validates('name')
    def validate_name(self, key, name):
        """
        Validates organization name against business rules.
        
        Args:
            key (str): Field name being validated
            name (str): Organization name to validate
            
        Returns:
            str: Validated organization name
            
        Raises:
            ValueError: If name validation fails
        """
        if not name or len(name) < 2 or len(name) > 100:
            raise ValueError("Organization name must be between 2 and 100 characters")
        
        # Ensure name contains valid characters
        if not name.replace(' ', '').replace('-', '').replace('_', '').isalnum():
            raise ValueError("Organization name can only contain letters, numbers, spaces, hyphens, and underscores")
        
        return name.strip()

    @validates('settings')
    def validate_settings(self, key, settings):
        """
        Validates organization settings against defined schema.
        
        Args:
            key (str): Field name being validated
            settings (dict): Settings dictionary to validate
            
        Returns:
            dict: Validated settings dictionary
            
        Raises:
            ValueError: If settings validation fails
        """
        if not isinstance(settings, dict):
            raise ValueError("Settings must be a dictionary")

        required_keys = {'features', 'preferences', 'limits'}
        if not all(key in settings for key in required_keys):
            raise ValueError(f"Settings must contain all required keys: {required_keys}")

        # Validate settings structure
        if not isinstance(settings.get('features'), dict):
            raise ValueError("Features must be a dictionary")
        if not isinstance(settings.get('preferences'), dict):
            raise ValueError("Preferences must be a dictionary")
        if not isinstance(settings.get('limits'), dict):
            raise ValueError("Limits must be a dictionary")

        return settings

# Create composite index for common query patterns
Index('ix_org_name_created', Organization.name, Organization.created_at)