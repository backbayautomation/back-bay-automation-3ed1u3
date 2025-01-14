"""
Celery application configuration module for distributed task processing in the AI-powered Product Catalog Search System.
Handles asynchronous document processing, OCR, and AI operations with enhanced error handling and monitoring.

Version: 1.0.0
"""

import logging
from celery import Celery  # version: 5.3.0
from kombu import Queue, Exchange  # version: 5.3.0
from app.core.config import settings

# Configure module logger
logger = logging.getLogger(__name__)

# Celery broker and backend URLs from Azure Redis settings
CELERY_BROKER_URL = settings.get_azure_settings()['redis_connection_string']
CELERY_RESULT_BACKEND = settings.get_azure_settings()['redis_connection_string']

# Define task queues with priorities
TASK_QUEUES = {
    'document_processing': Queue('document_processing', Exchange('document_processing'), routing_key='document_processing', queue_arguments={'x-max-priority': 10}),
    'ocr_tasks': Queue('ocr_tasks', Exchange('ocr_tasks'), routing_key='ocr_tasks', queue_arguments={'x-max-priority': 8}),
    'ai_tasks': Queue('ai_tasks', Exchange('ai_tasks'), routing_key='ai_tasks', queue_arguments={'x-max-priority': 6}),
    'default': Queue('default', Exchange('default'), routing_key='default', queue_arguments={'x-max-priority': 4})
}

# Task routing configuration
TASK_ROUTES = {
    'app.tasks.documents.*': {'queue': 'document_processing'},
    'app.tasks.ocr.*': {'queue': 'ocr_tasks'},
    'app.tasks.ai.*': {'queue': 'ai_tasks'}
}

class CeleryConfig:
    """Enhanced configuration class for Celery settings with task-specific configurations."""

    # Broker and backend configuration
    broker_url = CELERY_BROKER_URL
    result_backend = CELERY_RESULT_BACKEND
    
    # Serialization settings
    task_serializer = 'json'
    result_serializer = 'json'
    accept_content = ['json']
    task_compression = 'gzip'
    
    # Queue configuration
    task_queues = tuple(TASK_QUEUES.values())
    task_routes = TASK_ROUTES
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
    
    # Task execution settings
    task_soft_time_limit = 3600  # 1 hour
    task_time_limit = 7200      # 2 hours
    task_track_started = True
    worker_prefetch_multiplier = 1
    worker_concurrency = 8
    
    # Error handling and retry settings
    task_acks_late = True
    task_reject_on_worker_lost = True
    task_store_errors_even_if_ignored = True
    
    # Task annotations for retry policies
    task_annotations = {
        'app.tasks.documents.*': {
            'retry_backoff': True,
            'retry_backoff_max': 3600,
            'max_retries': 3
        },
        'app.tasks.ocr.*': {
            'retry_backoff': True,
            'retry_backoff_max': 1800,
            'max_retries': 2
        },
        'app.tasks.ai.*': {
            'retry_backoff': True,
            'retry_backoff_max': 900,
            'max_retries': 2
        }
    }

    def get_task_routes(self):
        """Returns task routing configuration based on task type."""
        return self.task_routes

def create_celery():
    """Creates and configures the Celery application instance with enhanced error handling and monitoring."""
    
    # Initialize Celery application
    celery_app = Celery(
        'catalog_search',
        broker=CELERY_BROKER_URL,
        backend=CELERY_RESULT_BACKEND,
        include=[
            'app.tasks.documents',
            'app.tasks.ocr',
            'app.tasks.ai'
        ]
    )

    # Apply configuration
    celery_app.config_from_object(CeleryConfig)

    # Configure logging
    celery_app.conf.update(
        worker_log_format='[%(asctime)s: %(levelname)s/%(processName)s] %(message)s',
        worker_task_log_format='[%(asctime)s: %(levelname)s/%(processName)s] [%(task_name)s(%(task_id)s)] %(message)s'
    )

    # Configure error handling
    def on_task_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            f"Task {task_id} failed: {exc}",
            extra={
                'task_id': task_id,
                'args': args,
                'kwargs': kwargs,
                'exception': str(exc),
                'traceback': einfo.traceback if einfo else None
            }
        )

    celery_app.conf.task_on_failure = on_task_failure

    return celery_app

# Create and export Celery application instance
celery_app = create_celery()