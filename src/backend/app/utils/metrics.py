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
from azure.monitor.opentelemetry import AzureMonitorClient  # version: 1.0.0

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
    """Thread-safe metrics collection class with Azure Monitor and Prometheus integration."""

    def __init__(self, config=None):
        """Initialize metrics collector with monitoring system integration."""
        self._metrics = {}
        self._labels = {}
        self._lock = threading.Lock()
        self._batch_queue = asyncio.Queue()
        self._prometheus_registry = CollectorRegistry()

        # Initialize Azure Monitor client in production
        if ENVIRONMENT == "production":
            self._azure_client = AzureMonitorClient.from_connection_string(
                AZURE_MONITOR_CONNECTION_STRING
            )
        else:
            self._azure_client = None

        # Start background batch processing
        asyncio.create_task(self.process_batch())

    @contextlib.contextmanager
    async def record_time(self, metric_name: str, labels: dict = None, async_mode: bool = True):
        """Record execution time with async support."""
        if not labels:
            labels = {}

        if len(labels) > MAX_LABEL_COUNT:
            logger.warning(f"Exceeded maximum label count for metric {metric_name}")
            labels = dict(list(labels.items())[:MAX_LABEL_COUNT])

        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            with self._lock:
                if metric_name not in self._metrics:
                    self._metrics[metric_name] = Histogram(
                        metric_name,
                        metric_name,
                        labels.keys(),
                        buckets=DEFAULT_BUCKETS,
                        registry=self._prometheus_registry
                    )
                self._metrics[metric_name].labels(**labels).observe(duration)
                await self._batch_queue.put({
                    "name": metric_name,
                    "type": "histogram",
                    "value": duration,
                    "labels": labels
                })

    def increment_counter(self, metric_name: str, value: float = 1.0, labels: dict = None):
        """Thread-safe counter increment."""
        if not labels:
            labels = {}

        with self._lock:
            if metric_name not in self._metrics:
                self._metrics[metric_name] = Counter(
                    metric_name,
                    metric_name,
                    labels.keys(),
                    registry=self._prometheus_registry
                )
            self._metrics[metric_name].labels(**labels).inc(value)
            asyncio.create_task(self._batch_queue.put({
                "name": metric_name,
                "type": "counter",
                "value": value,
                "labels": labels
            }))

    def set_gauge(self, metric_name: str, value: float, labels: dict = None):
        """Thread-safe gauge value setting."""
        if not labels:
            labels = {}

        with self._lock:
            if metric_name not in self._metrics:
                self._metrics[metric_name] = Gauge(
                    metric_name,
                    metric_name,
                    labels.keys(),
                    registry=self._prometheus_registry
                )
            self._metrics[metric_name].labels(**labels).set(value)
            asyncio.create_task(self._batch_queue.put({
                "name": metric_name,
                "type": "gauge",
                "value": value,
                "labels": labels
            }))

    def observe_value(self, metric_name: str, value: float, metric_type: str = "histogram", labels: dict = None):
        """Thread-safe observation recording."""
        if not labels:
            labels = {}

        if metric_type not in METRIC_TYPES:
            logger.error(f"Invalid metric type: {metric_type}")
            return

        with self._lock:
            if metric_name not in self._metrics:
                metric_class = globals()[METRIC_TYPES[metric_type]]
                self._metrics[metric_name] = metric_class(
                    metric_name,
                    metric_name,
                    labels.keys(),
                    registry=self._prometheus_registry
                )
            self._metrics[metric_name].labels(**labels).observe(value)
            asyncio.create_task(self._batch_queue.put({
                "name": metric_name,
                "type": metric_type,
                "value": value,
                "labels": labels
            }))

    async def process_batch(self):
        """Process batched metrics asynchronously."""
        while True:
            batch = []
            try:
                while len(batch) < METRIC_BATCH_SIZE:
                    try:
                        metric = await asyncio.wait_for(
                            self._batch_queue.get(),
                            timeout=BATCH_TIMEOUT
                        )
                        batch.append(metric)
                    except asyncio.TimeoutError:
                        break

                if batch:
                    if self._azure_client and ENVIRONMENT == "production":
                        await self._azure_client.export_metrics(batch)
                    
                    logger.debug(f"Processed batch of {len(batch)} metrics")

            except Exception as e:
                logger.error(f"Error processing metric batch: {str(e)}")
                await asyncio.sleep(1)  # Backoff on error