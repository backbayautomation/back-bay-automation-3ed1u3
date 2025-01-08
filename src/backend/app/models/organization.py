from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, JSON, DateTime, UUID, MetaData, Index
from sqlalchemy.orm import declarative_base, relationship, validates

# Initialize base class with tenant schema
Base = declarative_base(metadata=MetaData(schema='tenant'))

class Organization(Base):
    """
    SQLAlchemy model representing an organization in the multi-tenant system.
    Implements comprehensive tenant isolation, data partitioning, and relationship management
    with robust security controls and audit capabilities.
    """
    __tablename__ = 'organizations'

    # Primary Fields
    id = Column(UUID, primary_key=True, default=uuid4, index=True, 
                doc="Unique identifier for the organization")
    name = Column(String(100), nullable=False, index=True, unique=True,
                 doc="Organization's unique name")
    settings = Column(JSON, nullable=False, 
                     default={'features': {}, 'preferences': {}, 'limits': {}},
                     doc="Organization-specific settings and configurations")
    
    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True,
                       doc="Timestamp of organization creation")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, 
                       onupdate=datetime.utcnow, index=True,
                       doc="Timestamp of last organization update")

    # Relationships
    clients = relationship('Client', back_populates='organization',
                         cascade='all, delete-orphan', lazy='select',
                         order_by='Client.name',
                         doc="Associated clients for this organization")

    # Indexes for performance optimization
    __table_args__ = (
        Index('ix_org_name_created', 'name', 'created_at'),
        Index('ix_org_updated', 'updated_at'),
        {'extend_existing': True}
    )

    def __repr__(self):
        """
        String representation of the Organization instance.
        
        Returns:
            str: Formatted string with organization name and ID
        """
        return f"<Organization(name='{self.name}', id='{self.id}')>"

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
        if not name or not isinstance(name, str):
            raise ValueError("Organization name must be a non-empty string")
        
        if not 2 <= len(name) <= 100:
            raise ValueError("Organization name must be between 2 and 100 characters")
        
        # Check for valid characters (alphanumeric, spaces, and basic punctuation)
        if not all(c.isalnum() or c.isspace() or c in '.-_&' for c in name):
            raise ValueError("Organization name contains invalid characters")
        
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

        # Validate features
        if not isinstance(settings['features'], dict):
            raise ValueError("Features must be a dictionary")

        # Validate preferences
        if not isinstance(settings['preferences'], dict):
            raise ValueError("Preferences must be a dictionary")

        # Validate limits
        if not isinstance(settings['limits'], dict):
            raise ValueError("Limits must be a dictionary")

        return settings