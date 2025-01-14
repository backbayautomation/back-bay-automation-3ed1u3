"""
SQLAlchemy session management and database connection handling module.
Provides thread-safe session factories and connection pooling with comprehensive monitoring.

Version: 1.0.0
"""

import logging
from contextlib import contextmanager
from typing import Generator, Dict, Any

from sqlalchemy import create_engine, event  # version: 2.0.0
from sqlalchemy.orm import sessionmaker, Session  # version: 2.0.0
from sqlalchemy.ext.declarative import declarative_base  # version: 2.0.0
from sqlalchemy.exc import SQLAlchemyError
from prometheus_client import Counter, Gauge  # version: 0.17.0

from ..core.config import get_settings

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()
db_settings = settings.get_database_settings()

# Create SQLAlchemy engine with optimized connection pooling
engine = create_engine(
    f"postgresql://{db_settings['username']}:{db_settings['password']}@"
    f"{db_settings['host']}:{db_settings['port']}/{db_settings['database']}",
    pool_size=db_settings['pool_size'],
    max_overflow=db_settings['max_overflow'],
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    connect_args={
        'connect_timeout': 10,
        'application_name': 'catalog_search_app',
        'options': '-c statement_timeout=30000'  # 30 second query timeout
    } if settings.ENVIRONMENT == 'production' else {}
)

# Create session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

# Create declarative base for models
Base = declarative_base()

# Initialize Prometheus metrics
session_metrics = Counter('db_session_total', 'Total number of database sessions created')
pool_metrics = Gauge('db_pool_connections', 'Current number of database connections in pool')
query_duration_metrics = Counter('db_query_duration_seconds', 'Total duration of database queries')
transaction_metrics = Counter('db_transaction_total', 'Total number of database transactions', ['status'])

@event.listens_for(engine, 'checkout')
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Monitor connection pool checkouts and update metrics."""
    pool_metrics.inc()

@event.listens_for(engine, 'checkin')
def receive_checkin(dbapi_connection, connection_record):
    """Monitor connection pool checkins and update metrics."""
    pool_metrics.dec()

@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Enhanced context manager for database sessions with comprehensive error handling
    and monitoring. Provides thread-safe session management with automatic cleanup.
    """
    session_metrics.inc()
    session = SessionLocal()
    
    try:
        # Set session configuration for production environment
        if settings.ENVIRONMENT == 'production':
            session.execute("SET SESSION statement_timeout = '30s'")
            session.execute("SET SESSION idle_in_transaction_session_timeout = '60s'")
        
        logger.debug("Database session created")
        yield session
        
        session.commit()
        transaction_metrics.labels(status='success').inc()
        logger.debug("Transaction committed successfully")
        
    except SQLAlchemyError as e:
        session.rollback()
        transaction_metrics.labels(status='error').inc()
        logger.error(f"Database error occurred: {str(e)}", exc_info=True)
        raise
    
    except Exception as e:
        session.rollback()
        transaction_metrics.labels(status='error').inc()
        logger.error(f"Unexpected error in database session: {str(e)}", exc_info=True)
        raise
    
    finally:
        session.close()
        logger.debug("Database session closed")

def init_db() -> bool:
    """
    Initialize database with enhanced validation and monitoring.
    Returns success status of initialization.
    """
    try:
        # Validate database connection
        with engine.connect() as connection:
            connection.execute("SELECT 1")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        # Verify database permissions
        with SessionLocal() as session:
            session.execute("SELECT current_user")
            session.execute("SELECT session_user")
        
        logger.info("Database initialized successfully")
        return True
    
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        return False

def monitor_pool_health() -> Dict[str, Any]:
    """
    Monitor database connection pool health and metrics.
    Returns dictionary of pool health statistics.
    """
    try:
        pool_stats = {
            'pool_size': engine.pool.size(),
            'checkedin': engine.pool.checkedin(),
            'checkedout': engine.pool.checkedout(),
            'overflow': engine.pool.overflow(),
            'timeout': engine.pool.timeout()
        }
        
        # Log warning if pool utilization is high
        if pool_stats['checkedout'] / pool_stats['pool_size'] > 0.8:
            logger.warning("Database connection pool utilization above 80%")
        
        return pool_stats
    
    except Exception as e:
        logger.error(f"Error monitoring pool health: {str(e)}", exc_info=True)
        return {}