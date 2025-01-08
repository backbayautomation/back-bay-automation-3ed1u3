"""
Core metrics collection and monitoring utility module for the AI-powered Product Catalog Search System.
Provides functionality for tracking performance metrics, usage statistics, and system health indicators.

Version: 1.0.0
"""

import time  # Python 3.11+
import asyncio  # Python 3.11+
import threading  # Python 3.11+
import contextlib  # Python 3.11+
from prometheus_client import Counter, Gauge, Histogram, Summary, CollectorRegistry  # version: 0.17.0
from azure.monitor.opentelemetry import configure_azure_monitor  # version: 1.0.0

from ..config import settings
from .logging import StructuredLogger

# Initialize structured logger
logger = StructuredLogger(__name__)

# Metric type constants
METRIC_TYPES = {
    "counter": "Counter",
    "gauge": "Gauge",
    "histogram": "Histogram",
    "summary": "Summary"
}

# Default histogram buckets aligned with response time SLAs
DEFAULT_BUCKETS = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]

# Metric name prefixes for different categories
METRIC_PREFIXES = {
    "system": "sys",
    "user": "usr",
    "performance": "perf",
    "business": "biz"
}

# Maximum number of labels per metric
MAX_LABEL_COUNT = 10

# Batch processing timeout in seconds
BATCH_TIMEOUT = 5.0

class MetricsCollector:
    """Thread-safe metrics collection class with Azure Monitor and Prometheus integration."""

    def __init__(self, config=None):
        """Initialize metrics collector with monitoring system integration."""
        self._metrics = {}
        self._labels = {}
        self._lock = threading.Lock()
        self._batch_queue = asyncio.Queue()
        
        # Initialize Prometheus registry
        self._prometheus_registry = CollectorRegistry()
        
        # Configure Azure Monitor in production
        if settings.ENVIRONMENT == "production":
            self._azure_client = configure_azure_monitor(
                connection_string=settings.AZURE_MONITOR_CONNECTION_STRING,
                service_name="catalog-search",
                service_version="1.0.0"
            )
        else:
            self._azure_client = None

        # Start background batch processing
        asyncio.create_task(self.process_batch())

    @contextlib.contextmanager
    def record_time(self, metric_name, labels=None, async_mode=False):
        """Record execution time of a function or code block."""
        if not metric_name:
            raise ValueError("Metric name cannot be empty")
            
        if labels and len(labels) > MAX_LABEL_COUNT:
            raise ValueError(f"Too many labels. Maximum allowed: {MAX_LABEL_COUNT}")

        start_time = time.time()
        
        try:
            with self._lock:
                if metric_name not in self._metrics:
                    self._metrics[metric_name] = Histogram(
                        metric_name,
                        "Execution time in seconds",
                        labels.keys() if labels else [],
                        registry=self._prometheus_registry,
                        buckets=DEFAULT_BUCKETS
                    )
            yield
        finally:
            duration = time.time() - start_time
            
            with self._lock:
                # Record in Prometheus
                if labels:
                    self._metrics[metric_name].labels(**labels).observe(duration)
                else:
                    self._metrics[metric_name].observe(duration)
                
                # Add to batch queue for Azure Monitor
                if self._azure_client:
                    asyncio.create_task(self._batch_queue.put({
                        "name": metric_name,
                        "value": duration,
                        "type": "histogram",
                        "labels": labels
                    }))
            
            logger.debug(f"Recorded duration for {metric_name}: {duration}s")

    def increment_counter(self, metric_name, value=1.0, labels=None):
        """Thread-safe increment of a counter metric."""
        if not metric_name:
            raise ValueError("Metric name cannot be empty")
            
        if not isinstance(value, (int, float)) or value < 0:
            raise ValueError("Counter increment must be a positive number")

        with self._lock:
            if metric_name not in self._metrics:
                self._metrics[metric_name] = Counter(
                    metric_name,
                    "Counter metric",
                    labels.keys() if labels else [],
                    registry=self._prometheus_registry
                )
            
            # Increment Prometheus counter
            if labels:
                self._metrics[metric_name].labels(**labels).inc(value)
            else:
                self._metrics[metric_name].inc(value)
            
            # Add to batch queue for Azure Monitor
            if self._azure_client:
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": "counter",
                    "labels": labels
                }))
        
        logger.debug(f"Incremented counter {metric_name} by {value}")

    def set_gauge(self, metric_name, value, labels=None):
        """Thread-safe gauge value setting."""
        if not metric_name:
            raise ValueError("Metric name cannot be empty")
            
        if not isinstance(value, (int, float)):
            raise ValueError("Gauge value must be a number")

        with self._lock:
            if metric_name not in self._metrics:
                self._metrics[metric_name] = Gauge(
                    metric_name,
                    "Gauge metric",
                    labels.keys() if labels else [],
                    registry=self._prometheus_registry
                )
            
            # Set Prometheus gauge
            if labels:
                self._metrics[metric_name].labels(**labels).set(value)
            else:
                self._metrics[metric_name].set(value)
            
            # Add to batch queue for Azure Monitor
            if self._azure_client:
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": "gauge",
                    "labels": labels
                }))
        
        logger.debug(f"Set gauge {metric_name} to {value}")

    def observe_value(self, metric_name, value, metric_type="histogram", labels=None):
        """Thread-safe observation recording for histograms and summaries."""
        if not metric_name:
            raise ValueError("Metric name cannot be empty")
            
        if metric_type not in ["histogram", "summary"]:
            raise ValueError("Invalid metric type. Must be 'histogram' or 'summary'")
            
        if not isinstance(value, (int, float)):
            raise ValueError("Observation value must be a number")

        with self._lock:
            if metric_name not in self._metrics:
                metric_class = Histogram if metric_type == "histogram" else Summary
                self._metrics[metric_name] = metric_class(
                    metric_name,
                    f"{metric_type.capitalize()} metric",
                    labels.keys() if labels else [],
                    registry=self._prometheus_registry,
                    buckets=DEFAULT_BUCKETS if metric_type == "histogram" else None
                )
            
            # Record observation in Prometheus
            if labels:
                self._metrics[metric_name].labels(**labels).observe(value)
            else:
                self._metrics[metric_name].observe(value)
            
            # Add to batch queue for Azure Monitor
            if self._azure_client:
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": metric_type,
                    "labels": labels
                }))
        
        logger.debug(f"Recorded {metric_type} observation for {metric_name}: {value}")

    async def process_batch(self):
        """Process batched metrics and export to monitoring systems."""
        while True:
            try:
                batch = []
                try:
                    # Collect metrics for BATCH_TIMEOUT seconds
                    while True:
                        try:
                            metric = await asyncio.wait_for(
                                self._batch_queue.get(),
                                timeout=BATCH_TIMEOUT
                            )
                            batch.append(metric)
                        except asyncio.TimeoutError:
                            break
                
                    if not batch:
                        continue

                    # Export to Azure Monitor if configured
                    if self._azure_client:
                        for metric in batch:
                            try:
                                self._azure_client.track_metric(
                                    name=metric["name"],
                                    value=metric["value"],
                                    properties=metric["labels"]
                                )
                            except Exception as e:
                                logger.error(f"Failed to export metric to Azure Monitor: {str(e)}")
                
                except Exception as e:
                    logger.error(f"Error in batch processing: {str(e)}")
                    
            except Exception as e:
                logger.error(f"Critical error in metrics batch processing: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on persistent errors