"""
Analytics service module implementing comprehensive metrics collection and monitoring
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
import logging
import asyncio
from typing import Dict, List, Optional, Any
from uuid import UUID

import sqlalchemy  # version: 2.0.0
import pandas as pd  # version: 2.0.0
from azure.monitor import AzureMonitorClient  # version: 5.0.0

from app.models.organization import Organization
from app.models.client import Client
from app.models.document import Document
from app.utils.metrics import MetricsCollector
from app.services.cache_service import CacheService

# Initialize structured logger
logger = logging.getLogger(__name__)

# Constants for analytics operations
CACHE_TTL = 3600  # 1 hour cache TTL
METRICS_INTERVAL = 300  # 5 minutes for real-time metrics
BATCH_SIZE = 1000  # Batch size for data processing
MAX_RETRIES = 3  # Maximum retry attempts

class AnalyticsService:
    """
    Enhanced analytics service implementing comprehensive metrics collection,
    real-time monitoring, and secure multi-tenant analytics.
    """

    def __init__(
        self,
        db_session,
        metrics_collector: MetricsCollector,
        cache_service: CacheService,
        config: Dict
    ):
        """
        Initialize analytics service with required dependencies.

        Args:
            db_session: Database session factory
            metrics_collector: Metrics collection utility
            cache_service: Caching service
            config: Service configuration
        """
        self._db = db_session
        self._metrics = metrics_collector
        self._cache = cache_service
        self._config = config
        self._monitor_client = None

        # Initialize Azure Monitor in production
        if config.get('environment') == 'production':
            self._monitor_client = AzureMonitorClient.from_connection_string(
                config['azure']['monitor_connection_string']
            )

        logger.info("Analytics service initialized", extra={'config': config})

    async def get_organization_metrics(
        self,
        org_id: UUID,
        start_date: datetime,
        end_date: datetime,
        filters: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive analytics metrics for an organization.

        Args:
            org_id: Organization ID
            start_date: Start date for metrics
            end_date: End date for metrics
            filters: Optional metric filters

        Returns:
            Dict containing comprehensive organization metrics
        """
        cache_key = f"org_metrics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        
        # Try to get from cache first
        cached_metrics = await self._cache.get(cache_key)
        if cached_metrics:
            logger.debug("Returning cached organization metrics", extra={'org_id': org_id})
            return cached_metrics

        try:
            async with self._metrics.record_time("org_metrics_calculation"):
                # Get base organization data
                org_data = await self._get_organization_data(org_id)
                
                # Get client metrics
                client_metrics = await self._get_client_metrics(org_id, start_date, end_date)
                
                # Get document processing metrics
                doc_metrics = await self._get_document_metrics(org_id, start_date, end_date)
                
                # Get performance metrics
                perf_metrics = await self._get_performance_metrics(org_id, start_date, end_date)
                
                # Combine all metrics
                metrics = {
                    'organization': org_data,
                    'clients': client_metrics,
                    'documents': doc_metrics,
                    'performance': perf_metrics,
                    'generated_at': datetime.utcnow().isoformat()
                }

                # Apply custom filters if provided
                if filters:
                    metrics = self._apply_metric_filters(metrics, filters)

                # Cache the results
                await self._cache.set(cache_key, metrics, ttl=CACHE_TTL)
                
                logger.info("Generated organization metrics", 
                           extra={'org_id': org_id, 'metric_count': len(metrics)})
                
                return metrics

        except Exception as e:
            logger.error(f"Error generating organization metrics: {str(e)}", 
                        exc_info=True, extra={'org_id': org_id})
            raise

    async def _get_organization_data(self, org_id: UUID) -> Dict[str, Any]:
        """Get base organization information and metadata."""
        async with self._db() as session:
            org = await session.query(Organization).filter(Organization.id == org_id).first()
            if not org:
                raise ValueError(f"Organization not found: {org_id}")
            
            return {
                'id': str(org.id),
                'name': org.name,
                'settings': org.settings,
                'created_at': org.created_at.isoformat()
            }

    async def _get_client_metrics(
        self,
        org_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate client-related metrics."""
        async with self._db() as session:
            # Get client statistics
            clients = await session.query(Client).filter(
                Client.org_id == org_id
            ).all()

            metrics = {
                'total_clients': len(clients),
                'active_clients': sum(1 for c in clients if c.updated_at >= start_date),
                'client_activity': [],
                'configurations': {
                    'features_enabled': {},
                    'integration_stats': {}
                }
            }

            # Process clients in batches
            for i in range(0, len(clients), BATCH_SIZE):
                batch = clients[i:i + BATCH_SIZE]
                
                # Analyze client activity
                activity_data = []
                for client in batch:
                    activity_data.append({
                        'client_id': str(client.id),
                        'name': client.name,
                        'document_count': len(client.documents),
                        'user_count': len(client.users),
                        'last_active': client.updated_at.isoformat()
                    })
                
                metrics['client_activity'].extend(activity_data)

                # Analyze feature usage
                for client in batch:
                    for feature, enabled in client.config.get('features', {}).items():
                        metrics['configurations']['features_enabled'][feature] = \
                            metrics['configurations']['features_enabled'].get(feature, 0) + (1 if enabled else 0)

            return metrics

    async def _get_document_metrics(
        self,
        org_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate document processing metrics."""
        async with self._db() as session:
            # Get all documents for organization's clients
            docs = await session.query(Document).join(
                Client, Client.id == Document.client_id
            ).filter(
                Client.org_id == org_id,
                Document.created_at.between(start_date, end_date)
            ).all()

            metrics = {
                'total_documents': len(docs),
                'processing_stats': {
                    'completed': 0,
                    'failed': 0,
                    'pending': 0,
                    'processing': 0
                },
                'type_distribution': {},
                'processing_times': [],
                'error_rates': {}
            }

            # Process documents in batches
            for i in range(0, len(docs), BATCH_SIZE):
                batch = docs[i:i + BATCH_SIZE]
                
                for doc in batch:
                    # Update status counts
                    metrics['processing_stats'][doc.status] += 1
                    
                    # Update type distribution
                    metrics['type_distribution'][doc.type] = \
                        metrics['type_distribution'].get(doc.type, 0) + 1
                    
                    # Calculate processing times for completed documents
                    if doc.status == 'completed' and doc.processed_at:
                        processing_time = (doc.processed_at - doc.created_at).total_seconds()
                        metrics['processing_times'].append(processing_time)
                    
                    # Track error rates
                    if doc.status == 'failed':
                        error_type = doc.metadata.get('error_type', 'unknown')
                        metrics['error_rates'][error_type] = \
                            metrics['error_rates'].get(error_type, 0) + 1

            # Calculate average processing time
            if metrics['processing_times']:
                metrics['avg_processing_time'] = sum(metrics['processing_times']) / len(metrics['processing_times'])
            
            return metrics

    async def _get_performance_metrics(
        self,
        org_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate system performance metrics."""
        metrics = {
            'response_times': [],
            'error_rates': {},
            'resource_usage': {
                'cpu': [],
                'memory': [],
                'storage': []
            },
            'availability': 0.0
        }

        # Get metrics from collector
        async with self._metrics.record_time("performance_metrics_calculation"):
            # Calculate average response times
            response_times = await self._metrics.get_response_times(org_id, start_date, end_date)
            metrics['response_times'] = response_times

            # Get error rates
            error_rates = await self._metrics.get_error_rates(org_id, start_date, end_date)
            metrics['error_rates'] = error_rates

            # Get resource usage metrics
            resource_metrics = await self._metrics.get_resource_metrics(org_id, start_date, end_date)
            metrics['resource_usage'] = resource_metrics

            # Calculate system availability
            uptime = await self._metrics.get_uptime(org_id, start_date, end_date)
            total_time = (end_date - start_date).total_seconds()
            metrics['availability'] = (uptime / total_time) * 100 if total_time > 0 else 0.0

        return metrics

    def _apply_metric_filters(self, metrics: Dict[str, Any], filters: Dict) -> Dict[str, Any]:
        """Apply custom filters to metrics data."""
        filtered_metrics = metrics.copy()

        for key, filter_value in filters.items():
            if key in filtered_metrics:
                if isinstance(filtered_metrics[key], dict):
                    filtered_metrics[key] = {
                        k: v for k, v in filtered_metrics[key].items()
                        if self._matches_filter(v, filter_value)
                    }
                elif isinstance(filtered_metrics[key], list):
                    filtered_metrics[key] = [
                        item for item in filtered_metrics[key]
                        if self._matches_filter(item, filter_value)
                    ]

        return filtered_metrics

    def _matches_filter(self, value: Any, filter_value: Any) -> bool:
        """Check if value matches filter criteria."""
        if isinstance(filter_value, dict):
            if 'min' in filter_value and value < filter_value['min']:
                return False
            if 'max' in filter_value and value > filter_value['max']:
                return False
            if 'contains' in filter_value and \
               isinstance(value, str) and \
               filter_value['contains'] not in value:
                return False
        else:
            return value == filter_value
        return True