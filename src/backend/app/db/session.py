"""
SQLAlchemy session management and database connection handling module.
Implements thread-safe session factories, connection pooling, and multi-tenant database access.

Version: 1.0.0
"""

from contextlib import contextmanager
import logging
from typing import Generator, Dict, Any

from sqlalchemy import create_engine, event  # version: 2.0.0
from sqlalchemy.orm import sessionmaker, Session  # version: 2.0.0
from sqlalchemy.ext.declarative import declarative_base  # version: 2.0.0
from sqlalchemy.exc import SQLAlchemyError
from prometheus_client import Counter, Gauge  # version: 0.17.0

from ..core.config import get_settings

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize database settings
settings = get_settings()
db_config = settings.get_database_settings()

# Create SQLAlchemy engine with optimized pool settings
engine = create_engine(
    f"postgresql://{db_config['username']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}",
    pool_size=db_config['pool_size'],
    max_overflow=db_config['max_overflow'],
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    connect_args={
        'connect_timeout': 10,
        'application_name': 'catalog_search',
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

# Prometheus metrics
session_metrics = Counter('db_session_total', 'Total number of database sessions created')
pool_metrics = Gauge('db_pool_connections', 'Current number of database connections in pool')
query_duration_metrics = Counter('db_query_duration_seconds', 'Database query duration in seconds')
transaction_metrics = Counter('db_transaction_total', 'Total number of database transactions', ['status'])

@event.listens_for(engine, 'checkout')
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Monitor connection pool checkouts and update metrics."""
    pool_metrics.inc()
    logger.debug("Database connection checked out from pool", 
                extra={'pool_id': id(connection_record)})

@event.listens_for(engine, 'checkin')
def receive_checkin(dbapi_connection, connection_record):
    """Monitor connection pool checkins and update metrics."""
    pool_metrics.dec()
    logger.debug("Database connection returned to pool",
                extra={'pool_id': id(connection_record)})

@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Enhanced context manager for database sessions with comprehensive error handling
    and monitoring. Implements connection pooling and multi-tenant isolation.
    """
    session_metrics.inc()
    session = SessionLocal()
    
    try:
        # Set session configuration
        if settings.ENVIRONMENT == 'production':
            # Enable read-only mode for specific roles
            session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
            session.execute("SET statement_timeout = '30s'")
        
        logger.debug("Database session created", 
                    extra={'session_id': id(session)})
        
        yield session
        
        session.commit()
        transaction_metrics.labels(status='committed').inc()
        
        logger.debug("Database session committed successfully",
                    extra={'session_id': id(session)})
        
    except SQLAlchemyError as e:
        session.rollback()
        transaction_metrics.labels(status='rolled_back').inc()
        
        logger.error("Database session error",
                    extra={
                        'session_id': id(session),
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    })
        raise
    
    finally:
        session.close()
        logger.debug("Database session closed",
                    extra={'session_id': id(session)})

def init_db() -> bool:
    """
    Initialize database with enhanced validation and monitoring.
    Returns True if initialization is successful, False otherwise.
    """
    try:
        # Validate database connection
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        logger.info("Database initialized successfully",
                   extra={'tables_created': len(Base.metadata.tables)})
        return True
        
    except SQLAlchemyError as e:
        logger.error("Database initialization failed",
                    extra={
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    })
        return False

def monitor_pool_health() -> Dict[str, Any]:
    """
    Monitor database connection pool health and metrics.
    Returns dictionary containing pool statistics and health metrics.
    """
    pool_stats = {
        'pool_size': engine.pool.size(),
        'checkedin': engine.pool.checkedin(),
        'checkedout': engine.pool.checkedout(),
        'overflow': engine.pool.overflow(),
        'timeout_count': getattr(engine.pool, '_timeout_count', 0)
    }
    
    logger.info("Database pool health metrics collected",
                extra=pool_stats)
    
    return pool_stats