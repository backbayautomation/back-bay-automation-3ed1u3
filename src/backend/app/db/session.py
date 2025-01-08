"""
Database session management module for the AI-powered Product Catalog Search System.
Implements thread-safe session factories, connection pooling, and monitoring.

Version: 1.0.0
"""

import logging
from contextlib import contextmanager
from typing import Generator, Dict, Any

from sqlalchemy import create_engine, event  # version: 2.0.0
from sqlalchemy.orm import sessionmaker, Session  # version: 2.0.0
from sqlalchemy.ext.declarative import declarative_base  # version: 2.0.0
from prometheus_client import Counter, Gauge  # version: 0.17.0

from ..core.config import get_settings

# Configure logging
logger = logging.getLogger(__name__)

# Initialize settings
settings = get_settings()
db_settings = settings.get_database_settings()

# Create engine with optimized pool settings based on environment
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
        'application_name': 'catalog_search',
        'options': '-c statement_timeout=30000'  # 30 second query timeout
    },
    echo=settings.DEBUG
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

# Initialize metrics collectors
session_metrics = Counter('db_session_total', 'Total number of database sessions created')
pool_metrics = Gauge('db_pool_connections', 'Current number of database connections in pool')
query_duration_metrics = Counter('db_query_duration_seconds', 'Total duration of database queries')
error_metrics = Counter('db_error_total', 'Total number of database errors', ['error_type'])

@event.listens_for(engine, 'checkout')
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Monitor connection checkouts from the pool."""
    pool_metrics.inc()

@event.listens_for(engine, 'checkin')
def receive_checkin(dbapi_connection, connection_record):
    """Monitor connection checkins to the pool."""
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
        # Set session configuration
        session.execute("SET statement_timeout TO '30s'")
        if not settings.DEBUG:
            session.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED")
        
        logger.debug("Database session created")
        yield session
        
        session.commit()
        logger.debug("Session committed successfully")
        
    except Exception as e:
        session.rollback()
        error_type = type(e).__name__
        error_metrics.labels(error_type=error_type).inc()
        logger.error(f"Database session error: {str(e)}", exc_info=True)
        raise
    
    finally:
        session.close()
        logger.debug("Database session closed")

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
        
        # Set up database-specific configurations
        with get_db() as db:
            # Set up any database triggers or constraints
            db.execute("""
                CREATE OR REPLACE FUNCTION update_modified_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.modified_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            """)
        
        logger.info("Database initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        error_metrics.labels(error_type=type(e).__name__).inc()
        return False

def monitor_pool_health() -> Dict[str, Any]:
    """
    Monitor database connection pool health and metrics.
    Returns dictionary containing pool statistics and health metrics.
    """
    try:
        pool_stats = {
            'pool_size': engine.pool.size(),
            'checkedin': engine.pool.checkedin(),
            'checkedout': engine.pool.checkedout(),
            'overflow': engine.pool.overflow(),
            'timeout': engine.pool.timeout()
        }
        
        # Update monitoring metrics
        pool_metrics.set(pool_stats['checkedout'])
        
        # Log pool status if utilization is high
        if pool_stats['checkedout'] / pool_stats['pool_size'] > 0.8:
            logger.warning("Database pool utilization exceeding 80%")
            
        return pool_stats
        
    except Exception as e:
        logger.error(f"Pool monitoring error: {str(e)}", exc_info=True)
        error_metrics.labels(error_type=type(e).__name__).inc()
        return {}

# Export session management components
__all__ = ['SessionLocal', 'Base', 'get_db', 'init_db', 'monitor_pool_health']