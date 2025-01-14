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
from azure.monitor.opentelemetry import configure_azure_monitor, metrics  # version: 1.0.0

from ..config.settings import ENVIRONMENT, AZURE_MONITOR_CONNECTION_STRING, METRIC_BATCH_SIZE
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
    """Thread-safe metrics collection with Azure Monitor and Prometheus integration."""
    
    def __init__(self, config=None):
        """Initialize metrics collector with monitoring system integration."""
        # Thread-safe storage
        self._metrics = {}
        self._labels = {}
        self._lock = threading.Lock()
        self._batch_queue = asyncio.Queue()
        
        # Initialize Prometheus registry
        self._prometheus_registry = CollectorRegistry()
        
        # Configure Azure Monitor for production
        if ENVIRONMENT == "production":
            self._azure_client = configure_azure_monitor(
                connection_string=AZURE_MONITOR_CONNECTION_STRING
            )
        else:
            self._azure_client = None
            
        # Start background batch processor
        asyncio.create_task(self.process_batch())

    @contextlib.contextmanager
    def record_time(self, metric_name, labels=None, async_mode=False):
        """Record execution time with support for async operations."""
        try:
            # Validate inputs
            if not metric_name:
                raise ValueError("Metric name is required")
            if labels and len(labels) > MAX_LABEL_COUNT:
                raise ValueError(f"Maximum {MAX_LABEL_COUNT} labels allowed")

            # Create histogram if not exists
            with self._lock:
                if metric_name not in self._metrics:
                    self._metrics[metric_name] = Histogram(
                        metric_name,
                        "Execution time in seconds",
                        labelnames=list(labels.keys()) if labels else [],
                        registry=self._prometheus_registry,
                        buckets=DEFAULT_BUCKETS
                    )

            start_time = time.perf_counter()
            yield
            
        finally:
            duration = time.perf_counter() - start_time
            
            # Record metric
            with self._lock:
                if labels:
                    self._metrics[metric_name].labels(**labels).observe(duration)
                else:
                    self._metrics[metric_name].observe(duration)
                
                # Add to batch queue
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": duration,
                    "type": "histogram",
                    "labels": labels
                }))
            
            # Log metric
            logger.info(f"Recorded execution time for {metric_name}: {duration:.3f}s")

    def increment_counter(self, metric_name, value=1.0, labels=None):
        """Thread-safe counter increment with batch support."""
        try:
            # Validate inputs
            if not metric_name or not isinstance(value, (int, float)):
                raise ValueError("Invalid metric name or value")
            
            with self._lock:
                # Create counter if not exists
                if metric_name not in self._metrics:
                    self._metrics[metric_name] = Counter(
                        metric_name,
                        "Counter metric",
                        labelnames=list(labels.keys()) if labels else [],
                        registry=self._prometheus_registry
                    )
                
                # Increment counter
                if labels:
                    self._metrics[metric_name].labels(**labels).inc(value)
                else:
                    self._metrics[metric_name].inc(value)
                
                # Add to batch queue
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": "counter",
                    "labels": labels
                }))
            
            logger.debug(f"Incremented counter {metric_name} by {value}")
            
        except Exception as e:
            logger.error(f"Error incrementing counter {metric_name}: {str(e)}")
            raise

    def set_gauge(self, metric_name, value, labels=None):
        """Thread-safe gauge value setting with validation."""
        try:
            # Validate inputs
            if not metric_name or not isinstance(value, (int, float)):
                raise ValueError("Invalid metric name or value")
            
            with self._lock:
                # Create gauge if not exists
                if metric_name not in self._metrics:
                    self._metrics[metric_name] = Gauge(
                        metric_name,
                        "Gauge metric",
                        labelnames=list(labels.keys()) if labels else [],
                        registry=self._prometheus_registry
                    )
                
                # Set gauge value
                if labels:
                    self._metrics[metric_name].labels(**labels).set(value)
                else:
                    self._metrics[metric_name].set(value)
                
                # Add to batch queue
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": "gauge",
                    "labels": labels
                }))
            
            logger.debug(f"Set gauge {metric_name} to {value}")
            
        except Exception as e:
            logger.error(f"Error setting gauge {metric_name}: {str(e)}")
            raise

    def observe_value(self, metric_name, value, metric_type="histogram", labels=None):
        """Thread-safe observation recording for histograms and summaries."""
        try:
            # Validate inputs
            if not metric_name or not isinstance(value, (int, float)):
                raise ValueError("Invalid metric name or value")
            if metric_type not in ["histogram", "summary"]:
                raise ValueError("Invalid metric type")
            
            with self._lock:
                # Create metric if not exists
                if metric_name not in self._metrics:
                    metric_class = Histogram if metric_type == "histogram" else Summary
                    self._metrics[metric_name] = metric_class(
                        metric_name,
                        f"{metric_type.capitalize()} metric",
                        labelnames=list(labels.keys()) if labels else [],
                        registry=self._prometheus_registry,
                        buckets=DEFAULT_BUCKETS if metric_type == "histogram" else None
                    )
                
                # Record observation
                if labels:
                    self._metrics[metric_name].labels(**labels).observe(value)
                else:
                    self._metrics[metric_name].observe(value)
                
                # Add to batch queue
                asyncio.create_task(self._batch_queue.put({
                    "name": metric_name,
                    "value": value,
                    "type": metric_type,
                    "labels": labels
                }))
            
            logger.debug(f"Recorded {metric_type} observation for {metric_name}: {value}")
            
        except Exception as e:
            logger.error(f"Error recording observation for {metric_name}: {str(e)}")
            raise

    async def process_batch(self):
        """Process batched metrics and export to monitoring systems."""
        while True:
            try:
                batch = []
                try:
                    # Collect metrics until batch size or timeout
                    while len(batch) < METRIC_BATCH_SIZE:
                        metric = await asyncio.wait_for(
                            self._batch_queue.get(),
                            timeout=BATCH_TIMEOUT
                        )
                        batch.append(metric)
                except asyncio.TimeoutError:
                    if not batch:
                        continue

                # Export metrics to Azure Monitor in production
                if ENVIRONMENT == "production" and self._azure_client:
                    for metric in batch:
                        try:
                            metrics.record_metric(
                                name=metric["name"],
                                value=metric["value"],
                                dimensions=metric["labels"]
                            )
                        except Exception as e:
                            logger.error(f"Error exporting metric to Azure Monitor: {str(e)}")

                logger.debug(f"Processed batch of {len(batch)} metrics")
                
            except Exception as e:
                logger.error(f"Error in batch processing: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on persistent errors