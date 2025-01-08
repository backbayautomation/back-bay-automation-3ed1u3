"""
Analytics service module implementing comprehensive metrics collection and monitoring
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import logging  # latest
import pandas as pd  # version: 2.0.0
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import func, and_, text  # version: 2.0.0
from azure.monitor import AzureMonitorClient  # version: 5.0.0

from app.models.organization import Organization
from app.models.client import Client
from app.models.document import Document
from app.utils.metrics import MetricsCollector
from app.services.cache_service import CacheService

# Initialize structured logger
logger = logging.getLogger(__name__)

# Constants for analytics operations
CACHE_TTL = 3600  # Cache TTL in seconds
METRICS_INTERVAL = 300  # Metrics collection interval in seconds
BATCH_SIZE = 1000  # Batch size for database operations
MAX_RETRIES = 3  # Maximum retry attempts for failed operations

class AnalyticsService:
    """
    Enhanced analytics service implementing comprehensive metrics collection
    with real-time monitoring and secure multi-tenant support.
    """

    def __init__(self, db_session, metrics_collector: MetricsCollector, 
                 cache_service: CacheService, config: Dict):
        """
        Initialize analytics service with required dependencies.

        Args:
            db_session: Database session factory
            metrics_collector: Metrics collection utility
            cache_service: Cache service for results
            config: Service configuration parameters
        """
        self._db = db_session
        self._metrics = metrics_collector
        self._cache = cache_service
        self._config = config
        
        # Initialize Azure Monitor client for production
        if config.get('environment') == 'production':
            self._azure_monitor = AzureMonitorClient(
                connection_string=config['azure_monitor_connection_string']
            )
        else:
            self._azure_monitor = None

    async def get_organization_metrics(
        self,
        org_id: str,
        start_date: datetime,
        end_date: datetime,
        filters: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive analytics metrics for an organization.

        Args:
            org_id: Organization identifier
            start_date: Start date for metrics collection
            end_date: End date for metrics collection
            filters: Optional filtering parameters

        Returns:
            Dict containing detailed organization metrics
        """
        cache_key = f"org_metrics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        
        try:
            # Check cache first
            cached_result = await self._cache.get(cache_key)
            if cached_result:
                logger.debug("Returning cached organization metrics", 
                           extra={'org_id': org_id})
                return cached_result

            async with self._metrics.record_time("org_metrics_collection"):
                # Get base organization data
                org_data = await self._get_organization_data(org_id)
                
                # Get client metrics
                client_metrics = await self._get_client_metrics(
                    org_id, start_date, end_date, filters
                )
                
                # Get document processing metrics
                doc_metrics = await self._get_document_metrics(
                    org_id, start_date, end_date, filters
                )
                
                # Get usage metrics
                usage_metrics = await self._get_usage_metrics(
                    org_id, start_date, end_date, filters
                )
                
                # Compile comprehensive metrics
                metrics = {
                    'organization': org_data,
                    'period': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    },
                    'clients': client_metrics,
                    'documents': doc_metrics,
                    'usage': usage_metrics,
                    'generated_at': datetime.utcnow().isoformat()
                }
                
                # Cache results
                await self._cache.set(cache_key, metrics, ttl=CACHE_TTL)
                
                # Track metrics collection
                self._metrics.increment_counter(
                    'analytics_collection_success',
                    labels={'org_id': org_id}
                )
                
                return metrics

        except Exception as e:
            logger.error("Failed to collect organization metrics",
                        extra={'org_id': org_id, 'error': str(e)})
            self._metrics.increment_counter(
                'analytics_collection_error',
                labels={'org_id': org_id, 'error_type': type(e).__name__}
            )
            raise

    async def _get_organization_data(self, org_id: str) -> Dict:
        """Get base organization information."""
        async with self._db() as session:
            org = await session.query(Organization).filter(
                Organization.id == org_id
            ).first()
            
            if not org:
                raise ValueError(f"Organization not found: {org_id}")
            
            return {
                'id': str(org.id),
                'name': org.name,
                'created_at': org.created_at.isoformat(),
                'settings': org.settings
            }

    async def _get_client_metrics(
        self,
        org_id: str,
        start_date: datetime,
        end_date: datetime,
        filters: Optional[Dict]
    ) -> Dict:
        """Get detailed client metrics."""
        async with self._db() as session:
            # Get client statistics
            client_stats = await session.query(
                func.count(Client.id).label('total_clients'),
                func.count(Client.id).filter(
                    Client.created_at.between(start_date, end_date)
                ).label('new_clients')
            ).filter(
                Client.org_id == org_id
            ).first()
            
            # Get active clients
            active_clients = await session.query(
                func.count(Client.id)
            ).filter(
                and_(
                    Client.org_id == org_id,
                    Client.updated_at >= start_date
                )
            ).scalar()
            
            return {
                'total': client_stats.total_clients,
                'new': client_stats.new_clients,
                'active': active_clients,
                'engagement_rate': (
                    active_clients / client_stats.total_clients
                    if client_stats.total_clients > 0 else 0
                )
            }

    async def _get_document_metrics(
        self,
        org_id: str,
        start_date: datetime,
        end_date: datetime,
        filters: Optional[Dict]
    ) -> Dict:
        """Get detailed document processing metrics."""
        async with self._db() as session:
            # Get document statistics by status
            doc_stats = await session.query(
                Document.status,
                func.count(Document.id).label('count'),
                func.avg(
                    func.extract('epoch', Document.processed_at) -
                    func.extract('epoch', Document.created_at)
                ).label('avg_processing_time')
            ).join(
                Client, Document.client_id == Client.id
            ).filter(
                and_(
                    Client.org_id == org_id,
                    Document.created_at.between(start_date, end_date)
                )
            ).group_by(
                Document.status
            ).all()
            
            # Calculate processing success rate
            total_docs = sum(stat.count for stat in doc_stats)
            completed_docs = next(
                (stat.count for stat in doc_stats 
                 if stat.status == 'completed'),
                0
            )
            
            return {
                'total_documents': total_docs,
                'status_breakdown': {
                    stat.status: stat.count for stat in doc_stats
                },
                'success_rate': (
                    completed_docs / total_docs if total_docs > 0 else 0
                ),
                'avg_processing_time': {
                    stat.status: stat.avg_processing_time 
                    for stat in doc_stats if stat.avg_processing_time
                }
            }

    async def _get_usage_metrics(
        self,
        org_id: str,
        start_date: datetime,
        end_date: datetime,
        filters: Optional[Dict]
    ) -> Dict:
        """Get detailed usage and performance metrics."""
        # Get cached metrics from collector
        system_metrics = self._metrics.get_metrics(
            start_time=start_date,
            end_time=end_date,
            labels={'org_id': org_id}
        )
        
        # Calculate key performance indicators
        response_times = system_metrics.get('response_times', [])
        error_counts = system_metrics.get('error_counts', {})
        
        return {
            'requests': {
                'total': sum(system_metrics.get('request_counts', {}).values()),
                'success_rate': (
                    1 - sum(error_counts.values()) / 
                    sum(system_metrics.get('request_counts', {}).values())
                    if sum(system_metrics.get('request_counts', {}).values()) > 0 
                    else 0
                )
            },
            'performance': {
                'avg_response_time': (
                    sum(response_times) / len(response_times)
                    if response_times else 0
                ),
                'p95_response_time': (
                    pd.Series(response_times).quantile(0.95)
                    if response_times else 0
                ),
                'error_rate': (
                    sum(error_counts.values()) / 
                    sum(system_metrics.get('request_counts', {}).values())
                    if sum(system_metrics.get('request_counts', {}).values()) > 0 
                    else 0
                )
            },
            'resource_utilization': {
                'cpu': system_metrics.get('cpu_utilization', {}),
                'memory': system_metrics.get('memory_utilization', {}),
                'storage': system_metrics.get('storage_utilization', {})
            }
        }