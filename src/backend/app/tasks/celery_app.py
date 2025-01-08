"""
Celery application configuration module for distributed task processing in the AI-powered Product Catalog Search System.
Handles asynchronous document processing, OCR operations, and AI tasks with enhanced error handling and monitoring.

Version: 1.0.0
"""

import logging
from celery import Celery  # version: 5.3.0
from kombu import Queue, Exchange  # version: 5.3.0
from app.core.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Celery configuration class with enhanced settings
class CeleryConfig:
    """Enhanced configuration class for Celery settings with task-specific configurations."""

    # Broker and backend configuration with SSL
    broker_url = settings.get_azure_settings()['redis_cache']
    result_backend = settings.get_azure_settings()['redis_cache']

    # Serialization settings
    task_serializer = 'json'
    result_serializer = 'json'
    accept_content = ['json']
    task_compression = 'gzip'

    # Task execution settings
    task_soft_time_limit = 3600  # 1 hour
    task_time_limit = 3900  # 1 hour + 5 minutes grace period
    task_track_started = True
    worker_prefetch_multiplier = 1  # Prevent worker starvation
    worker_concurrency = 8  # Number of worker processes

    # Queue configuration with priorities
    task_queues = (
        Queue('document_processing', Exchange('document_processing'), routing_key='document_processing',
              queue_arguments={'x-max-priority': 10}),
        Queue('ocr_tasks', Exchange('ocr_tasks'), routing_key='ocr_tasks',
              queue_arguments={'x-max-priority': 8}),
        Queue('ai_tasks', Exchange('ai_tasks'), routing_key='ai_tasks',
              queue_arguments={'x-max-priority': 6}),
        Queue('default', Exchange('default'), routing_key='default',
              queue_arguments={'x-max-priority': 4}),
    )

    # Task routing configuration
    task_routes = {
        'app.tasks.documents.*': {'queue': 'document_processing'},
        'app.tasks.ocr.*': {'queue': 'ocr_tasks'},
        'app.tasks.ai.*': {'queue': 'ai_tasks'}
    }

    # Queue priorities
    task_queue_max_priority = {
        'document_processing': 10,
        'ocr_tasks': 8,
        'ai_tasks': 6,
        'default': 4
    }

    task_default_priority = {
        'document_processing': 5,
        'ocr_tasks': 4,
        'ai_tasks': 3,
        'default': 2
    }

    # Error handling and retry configuration
    task_annotations = {
        '*': {
            'rate_limit': '10/s',
            'max_retries': 3,
            'retry_backoff': True,
            'retry_backoff_max': 600,  # 10 minutes
            'retry_jitter': True
        }
    }

    # Result backend settings
    task_ignore_result = False
    task_store_errors_even_if_ignored = True
    task_reject_on_worker_lost = True
    task_acks_late = True

    def __init__(self):
        """Initialize Celery configuration with environment-specific settings."""
        # Configure dead letter exchange
        self.task_queues += (
            Queue('dead_letter', Exchange('dead_letter'), routing_key='dead_letter'),
        )

        # Set up error routing
        self.task_routes.update({
            'app.tasks.error_handlers.*': {'queue': 'dead_letter'}
        })

    def get_task_routes(self):
        """Returns task routing configuration based on task type."""
        return self.task_routes

def create_celery():
    """Creates and configures the Celery application instance with enhanced error handling and monitoring."""
    
    # Initialize Celery application
    celery_app = Celery('catalog_search')

    # Load configuration
    config = CeleryConfig()
    celery_app.config_from_object(config)

    # Configure logging
    celery_app.conf.update(
        worker_log_format='[%(asctime)s: %(levelname)s/%(processName)s] %(message)s',
        worker_task_log_format='[%(asctime)s: %(levelname)s/%(processName)s] [%(task_name)s(%(task_id)s)] %(message)s'
    )

    # Configure monitoring hooks
    @celery_app.task_received.connect
    def task_received_handler(request, **kwargs):
        logger.info(f"Task received: {request.task}", extra={
            'task_id': request.id,
            'task_name': request.task,
            'queue': request.delivery_info.get('routing_key')
        })

    @celery_app.task_success.connect
    def task_success_handler(sender=None, **kwargs):
        logger.info(f"Task completed successfully: {sender.name}", extra={
            'task_id': sender.request.id,
            'task_name': sender.name,
            'runtime': sender.request.runtime
        })

    @celery_app.task_failure.connect
    def task_failure_handler(sender=None, exception=None, **kwargs):
        logger.error(f"Task failed: {sender.name}", extra={
            'task_id': sender.request.id,
            'task_name': sender.name,
            'exception': str(exception),
            'traceback': sender.request.traceback
        })

    return celery_app

# Create and export Celery application instance
celery_app = create_celery()