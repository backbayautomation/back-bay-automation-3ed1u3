"""
Package initializer for the Celery tasks module in the AI-powered Product Catalog Search System.
Provides centralized task registration and exposure of all asynchronous task functions with
comprehensive monitoring and type safety.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging  # version: 3.11+

from .celery_app import celery_app
from .document_tasks import (
    process_document_task,
    cleanup_failed_document_task
)
from .embedding_tasks import (
    generate_embeddings,
    index_embeddings,
    clear_embedding_index
)

# Initialize module logger
logger = logging.getLogger(__name__)

# Package metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"

# Export all task functions for external use
__all__ = [
    "celery_app",
    "process_document_task",
    "cleanup_failed_document_task",
    "generate_embeddings",
    "index_embeddings",
    "clear_embedding_index"
]

# Log task registration on module import
logger.info(
    "Celery tasks registered successfully",
    extra={
        'registered_tasks': __all__,
        'celery_config': {
            'broker': celery_app.conf.broker_url,
            'backend': celery_app.conf.result_backend,
            'task_queues': [q.name for q in celery_app.conf.task_queues],
            'task_routes': celery_app.conf.task_routes
        }
    }
)

# Verify task registration and configuration
for task_name in [t for t in __all__ if t != "celery_app"]:
    task = globals()[task_name]
    if not hasattr(task, 'delay') or not hasattr(task, 'apply_async'):
        logger.error(
            f"Task {task_name} not properly registered with Celery",
            extra={'task': task_name}
        )
        raise RuntimeError(f"Task registration failed for {task_name}")

# Configure default task settings
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    worker_prefetch_multiplier=1,  # Prevent worker starvation
    task_acks_late=True,  # Ensure task completion before acknowledgment
    task_reject_on_worker_lost=True,  # Requeue tasks if worker dies
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default'
)

# Configure task error handling
@celery_app.task_failure.connect
def handle_task_failure(task_id, exception, args, kwargs, traceback, einfo, **_):
    """
    Global task failure handler with enhanced error reporting.
    
    Args:
        task_id: Failed task identifier
        exception: Exception that caused the failure
        args: Task arguments
        kwargs: Task keyword arguments
        traceback: Exception traceback
        einfo: Extended error information
    """
    logger.error(
        f"Task failure detected",
        extra={
            'task_id': task_id,
            'exception': str(exception),
            'args': args,
            'kwargs': kwargs,
            'traceback': str(traceback),
            'error_info': str(einfo)
        },
        exc_info=True
    )

# Configure task success handling
@celery_app.task_success.connect
def handle_task_success(sender, result, **_):
    """
    Global task success handler with result logging.
    
    Args:
        sender: Task that completed successfully
        result: Task execution result
    """
    logger.info(
        f"Task completed successfully",
        extra={
            'task': sender.name,
            'task_id': sender.request.id,
            'execution_time': sender.request.runtime,
            'result_type': type(result).__name__
        }
    )