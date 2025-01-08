"""
Package initializer for the Celery tasks module in the AI-powered Product Catalog Search System.
Provides centralized task registration and exposure of all asynchronous task functions.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging
from typing import Dict, Any

# Import Celery application instance
from .celery_app import celery_app

# Import document processing tasks
from .document_tasks import (
    process_document_task,
    cleanup_failed_document_task
)

# Import embedding generation tasks
from .embedding_tasks import (
    generate_embeddings,
    index_embeddings,
    clear_embedding_index
)

# Configure module logger
logger = logging.getLogger(__name__)

# Package metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"

# Export all task functions
__all__ = [
    "celery_app",
    "process_document_task",
    "cleanup_failed_document_task",
    "generate_embeddings", 
    "index_embeddings",
    "clear_embedding_index"
]

# Log task registration
logger.info(
    "Celery tasks registered successfully",
    extra={
        'registered_tasks': len(__all__) - 1,  # Subtract 1 to exclude celery_app
        'task_names': [task for task in __all__ if task != "celery_app"]
    }
)

def get_task_info() -> Dict[str, Any]:
    """
    Get information about registered Celery tasks with their configurations.
    
    Returns:
        Dict containing task names and their configurations
    """
    task_info = {}
    
    for task_name in __all__:
        if task_name == "celery_app":
            continue
            
        task = globals()[task_name]
        task_info[task_name] = {
            'queue': task.queue,
            'max_retries': task.max_retries,
            'time_limit': task.time_limit,
            'soft_time_limit': task.soft_time_limit,
            'retry_backoff': getattr(task, 'retry_backoff', False)
        }
    
    return task_info

# Validate task registration and configuration
try:
    task_info = get_task_info()
    logger.info(
        "Task configurations validated",
        extra={'task_info': task_info}
    )
except Exception as e:
    logger.error(
        "Task validation failed",
        extra={
            'error': str(e),
            'error_type': type(e).__name__
        }
    )
    raise RuntimeError(f"Failed to validate Celery tasks: {str(e)}")