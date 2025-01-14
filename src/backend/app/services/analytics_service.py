"""
Analytics service module implementing comprehensive analytics and metrics collection
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

# External imports
from sqlalchemy import func, and_, text  # version: 2.0.0
import pandas as pd  # version: 2.0.0
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional, Any
from azure.monitor import metrics  # version: 5.0.0

# Internal imports
from app.models.organization import Organization
from app.models.client import Client
from app.models.document import Document
from app.utils.metrics import MetricsCollector
from app.services.cache_service import CacheService

# Initialize logger
logger = logging.getLogger(__name__)

# Constants
CACHE_TTL = 3600  # 1 hour cache TTL
METRICS_INTERVAL = 300  # 5 minutes for real-time metrics
BATCH_SIZE = 1000  # Batch size for database operations
MAX_RETRIES = 3  # Maximum retry attempts for failed operations

class AnalyticsService:
    """
    Enhanced analytics service implementing comprehensive analytics functionality
    with real-time monitoring, caching, and secure multi-tenant support.
    """

    def __init__(self, db_session, metrics_collector: MetricsCollector, 
                 cache_service: CacheService, config: Dict):
        """
        Initialize analytics service with required dependencies.

        Args:
            db_session: Database session factory
            metrics_collector: Metrics collection utility
            cache_service: Caching service
            config: Application configuration
        """
        self._db = db_session
        self._metrics = metrics_collector
        self._cache = cache_service
        self._config = config
        
        # Initialize monitoring
        self._setup_monitoring()

    def _setup_monitoring(self) -> None:
        """Configure real-time monitoring and alerts."""
        logger.info("Initializing analytics monitoring")
        self._metrics.set_gauge("analytics_service_status", 1)

    async def get_organization_metrics(self, org_id: str, 
                                    start_date: datetime,
                                    end_date: datetime,
                                    filters: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Get comprehensive analytics metrics for an organization.

        Args:
            org_id: Organization ID
            start_date: Start date for metrics
            end_date: End date for metrics
            filters: Optional metric filters

        Returns:
            Dict containing detailed organization metrics
        """
        cache_key = f"org_metrics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        
        try:
            # Check cache first
            cached_metrics = await self._cache.get(cache_key)
            if cached_metrics:
                logger.debug("Returning cached organization metrics", 
                           extra={"org_id": org_id})
                return cached_metrics

            # Start metrics collection
            with self._metrics.record_time("org_metrics_collection", 
                                         labels={"org_id": org_id}):
                
                # Get base metrics
                base_metrics = await self._get_base_metrics(org_id, start_date, end_date)
                
                # Get document processing metrics
                doc_metrics = await self._get_document_metrics(org_id, start_date, end_date)
                
                # Get performance metrics
                perf_metrics = await self._get_performance_metrics(org_id, start_date, end_date)
                
                # Get usage patterns
                usage_patterns = await self._get_usage_patterns(org_id, start_date, end_date)

                # Compile complete metrics
                metrics = {
                    "organization": {
                        "id": org_id,
                        "metrics_period": {
                            "start": start_date.isoformat(),
                            "end": end_date.isoformat()
                        }
                    },
                    "base_metrics": base_metrics,
                    "document_metrics": doc_metrics,
                    "performance_metrics": perf_metrics,
                    "usage_patterns": usage_patterns,
                    "generated_at": datetime.utcnow().isoformat()
                }

                # Cache the results
                await self._cache.set(cache_key, metrics, ttl=CACHE_TTL)
                
                logger.info("Organization metrics generated successfully", 
                          extra={"org_id": org_id})
                return metrics

        except Exception as e:
            logger.error("Error generating organization metrics", 
                        extra={"org_id": org_id, "error": str(e)})
            self._metrics.increment_counter("org_metrics_errors", 
                                         labels={"org_id": org_id})
            raise

    async def _get_base_metrics(self, org_id: str, 
                              start_date: datetime,
                              end_date: datetime) -> Dict[str, Any]:
        """Get base organization metrics including client and user counts."""
        async with self._db() as session:
            # Get client count
            client_count = await session.scalar(
                select(func.count(Client.id))
                .where(Client.org_id == org_id)
            )

            # Get active clients
            active_clients = await session.scalar(
                select(func.count(Client.id))
                .where(
                    and_(
                        Client.org_id == org_id,
                        Client.updated_at >= start_date,
                        Client.updated_at <= end_date
                    )
                )
            )

            return {
                "total_clients": client_count,
                "active_clients": active_clients,
                "client_activity_rate": (active_clients / client_count) if client_count else 0
            }

    async def _get_document_metrics(self, org_id: str,
                                  start_date: datetime,
                                  end_date: datetime) -> Dict[str, Any]:
        """Get document processing and status metrics."""
        async with self._db() as session:
            # Get document counts by status
            doc_stats = await session.execute(
                select(
                    Document.status,
                    func.count(Document.id).label('count')
                )
                .join(Client, Document.client_id == Client.id)
                .where(
                    and_(
                        Client.org_id == org_id,
                        Document.created_at >= start_date,
                        Document.created_at <= end_date
                    )
                )
                .group_by(Document.status)
            )

            # Calculate processing times
            proc_times = await session.execute(
                select(
                    func.avg(Document.processed_at - Document.created_at),
                    func.min(Document.processed_at - Document.created_at),
                    func.max(Document.processed_at - Document.created_at)
                )
                .join(Client, Document.client_id == Client.id)
                .where(
                    and_(
                        Client.org_id == org_id,
                        Document.status == 'completed',
                        Document.created_at >= start_date,
                        Document.created_at <= end_date
                    )
                )
            )

            return {
                "document_counts": {
                    status: count for status, count in doc_stats
                },
                "processing_times": {
                    "average": proc_times[0],
                    "minimum": proc_times[1],
                    "maximum": proc_times[2]
                }
            }

    async def _get_performance_metrics(self, org_id: str,
                                     start_date: datetime,
                                     end_date: datetime) -> Dict[str, Any]:
        """Get system performance metrics."""
        # Get metrics from collector
        perf_data = self._metrics.get_metrics(
            start_time=start_date,
            end_time=end_date,
            labels={"org_id": org_id}
        )

        return {
            "response_times": {
                "p50": perf_data.get("response_time_p50", 0),
                "p95": perf_data.get("response_time_p95", 0),
                "p99": perf_data.get("response_time_p99", 0)
            },
            "success_rate": perf_data.get("success_rate", 0),
            "error_rate": perf_data.get("error_rate", 0),
            "resource_utilization": {
                "cpu": perf_data.get("cpu_utilization", 0),
                "memory": perf_data.get("memory_utilization", 0)
            }
        }

    async def _get_usage_patterns(self, org_id: str,
                                start_date: datetime,
                                end_date: datetime) -> Dict[str, Any]:
        """Analyze usage patterns and trends."""
        async with self._db() as session:
            # Get hourly usage patterns
            hourly_usage = await session.execute(
                select(
                    func.date_trunc('hour', Document.created_at),
                    func.count(Document.id)
                )
                .join(Client, Document.client_id == Client.id)
                .where(
                    and_(
                        Client.org_id == org_id,
                        Document.created_at >= start_date,
                        Document.created_at <= end_date
                    )
                )
                .group_by(func.date_trunc('hour', Document.created_at))
                .order_by(func.date_trunc('hour', Document.created_at))
            )

            # Convert to pandas for trend analysis
            df = pd.DataFrame(hourly_usage, columns=['timestamp', 'count'])
            
            return {
                "hourly_distribution": df.to_dict(orient='records'),
                "peak_usage_hour": df.loc[df['count'].idxmax(), 'timestamp'].hour,
                "average_daily_usage": df.groupby(df['timestamp'].dt.date)['count'].mean().mean()
            }