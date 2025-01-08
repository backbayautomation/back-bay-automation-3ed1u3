"""
Package initializer for the Celery tasks module providing centralized task registration
and exposure of all asynchronous task functions for document processing, embedding generation,
and notifications with comprehensive monitoring and type safety.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging  # version: 3.11+

# Import Celery application instance
from app.tasks.celery_app import celery_app

# Import document processing tasks
from app.tasks.document_tasks import (
    process_document_task,
    cleanup_failed_document_task
)

# Import embedding generation tasks
from app.tasks.embedding_tasks import (
    generate_embeddings,
    index_embeddings,
    clear_embedding_index
)

# Configure module logger
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

# Validate task registration and configuration
def validate_task_registration():
    """
    Validates that all required tasks are properly registered with Celery
    with correct queue assignments and retry policies.
    
    Returns:
        bool: True if validation succeeds, False otherwise
    """
    try:
        required_tasks = {
            'tasks.process_document': {
                'queue': 'document_processing',
                'max_retries': 3
            },
            'tasks.cleanup_failed_document': {
                'queue': 'document_processing',
                'max_retries': 1
            },
            'tasks.generate_embeddings': {
                'queue': 'embedding',
                'max_retries': 3
            },
            'tasks.index_embeddings': {
                'queue': 'embedding',
                'max_retries': 3
            },
            'tasks.clear_embedding_index': {
                'queue': 'embedding',
                'max_retries': 1
            }
        }

        registered_tasks = celery_app.tasks

        for task_name, config in required_tasks.items():
            if task_name not in registered_tasks:
                logger.error(f"Required task not registered: {task_name}")
                return False

            task = registered_tasks[task_name]
            if task.queue != config['queue']:
                logger.error(f"Incorrect queue for task {task_name}: {task.queue}")
                return False

            if task.max_retries != config['max_retries']:
                logger.error(f"Incorrect retry config for task {task_name}")
                return False

        logger.info("Task registration validation successful")
        return True

    except Exception as e:
        logger.error(f"Task validation error: {str(e)}", exc_info=True)
        return False

# Configure Celery task routing
task_routes = {
    'tasks.process_document': {'queue': 'document_processing'},
    'tasks.cleanup_failed_document': {'queue': 'document_processing'},
    'tasks.generate_embeddings': {'queue': 'embedding'},
    'tasks.index_embeddings': {'queue': 'embedding'},
    'tasks.clear_embedding_index': {'queue': 'embedding'}
}

# Update Celery configuration with task routes
celery_app.conf.task_routes = task_routes

# Validate task registration on module import
if not validate_task_registration():
    logger.critical("Critical error: Task registration validation failed")
    raise RuntimeError("Celery task initialization failed - invalid task configuration")

logger.info("Tasks module initialized successfully")