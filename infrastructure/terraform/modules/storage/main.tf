# Provider configuration
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Generate unique suffix for resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Azure Storage Account for document storage
resource "azurerm_storage_account" "document_storage" {
  name                     = "docs${random_string.suffix.result}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.storage_account_config.account_tier
  account_replication_type = var.storage_account_config.account_replication_type
  tags                     = var.tags

  # Security settings
  enable_https_traffic_only       = var.storage_account_config.enable_https_traffic_only
  min_tls_version                = var.storage_account_config.min_tls_version
  allow_nested_items_to_be_public = var.storage_account_config.allow_nested_items_to_be_public

  # Network rules
  network_rules {
    default_action             = var.storage_account_config.network_rules.default_action
    bypass                     = var.storage_account_config.network_rules.bypass
    ip_rules                  = var.storage_account_config.network_rules.ip_rules
    virtual_network_subnet_ids = var.storage_account_config.network_rules.virtual_network_subnet_ids
  }

  # Blob service properties
  blob_properties {
    versioning_enabled = var.storage_account_config.versioning_enabled
    delete_retention_policy {
      days = var.storage_account_config.delete_retention_days
    }
    container_delete_retention_policy {
      days = var.storage_account_config.blob_properties.container_delete_retention_days
    }
    cors_rule {
      allowed_headers    = var.storage_account_config.blob_properties.cors_rules.allowed_headers
      allowed_methods    = var.storage_account_config.blob_properties.cors_rules.allowed_methods
      allowed_origins    = var.storage_account_config.blob_properties.cors_rules.allowed_origins
      exposed_headers    = var.storage_account_config.blob_properties.cors_rules.exposed_headers
      max_age_in_seconds = var.storage_account_config.blob_properties.cors_rules.max_age_in_seconds
    }
  }

  # Lifecycle management
  lifecycle_rule {
    name    = "document-lifecycle"
    enabled = true
    filters {
      prefix_match = ["documents/"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days    = var.storage_account_config.lifecycle_rules.cool_tier_days
        tier_to_archive_after_days = var.storage_account_config.lifecycle_rules.archive_tier_days
        delete_after_days          = var.storage_account_config.lifecycle_rules.delete_after_days
      }
    }
  }
}

# Cosmos DB Account for vector storage
resource "azurerm_cosmosdb_account" "vector_store" {
  name                = "vectors${random_string.suffix.result}"
  resource_group_name = var.resource_group_name
  location           = var.location
  offer_type         = var.cosmos_db_config.offer_type
  kind               = var.cosmos_db_config.kind
  tags               = var.tags

  enable_automatic_failover = var.cosmos_db_config.enable_automatic_failover
  enable_multiple_write_locations = var.cosmos_db_config.enable_multiple_write_locations

  capabilities {
    name = var.cosmos_db_config.enable_serverless ? "EnableServerless" : "None"
  }

  consistency_policy {
    consistency_level       = var.cosmos_db_config.consistency_level
    max_interval_in_seconds = var.cosmos_db_config.performance_config.max_interval_in_seconds
    max_staleness_prefix   = var.cosmos_db_config.performance_config.max_staleness_prefix
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  backup_policy {
    type                = var.cosmos_db_config.backup_policy.type
    interval_in_minutes = var.cosmos_db_config.backup_policy.interval_in_minutes
    retention_in_hours  = var.cosmos_db_config.backup_policy.retention_in_hours
  }
}

# Redis Cache for performance optimization
resource "azurerm_redis_cache" "cache" {
  name                = "cache${random_string.suffix.result}"
  resource_group_name = var.resource_group_name
  location           = var.location
  capacity           = var.redis_cache_config.capacity
  family             = var.redis_cache_config.family
  sku_name           = var.redis_cache_config.sku_name
  tags               = var.tags

  enable_non_ssl_port = var.redis_cache_config.enable_non_ssl_port
  minimum_tls_version = var.redis_cache_config.minimum_tls_version
  shard_count        = var.redis_cache_config.shard_count

  redis_configuration {
    maxmemory_reserved = var.redis_cache_config.maxmemory_reserved
    maxmemory_delta    = var.redis_cache_config.maxmemory_delta
    maxmemory_policy   = var.redis_cache_config.maxmemory_policy
  }

  patch_schedule {
    day_of_week    = var.redis_cache_config.patch_schedule.day_of_week
    start_hour_utc = var.redis_cache_config.patch_schedule.start_hour_utc
  }

  # Clustering configuration
  dynamic "cluster_policy" {
    for_each = var.redis_cache_config.cluster_config.enabled ? [1] : []
    content {
      max_replicas_per_master = var.redis_cache_config.cluster_config.max_replicas_per_master
    }
  }

  # Persistence configuration
  persistence_configuration {
    enabled                = var.redis_cache_config.persistence_config.enabled
    frequency_in_minutes = var.redis_cache_config.persistence_config.frequency_in_minutes
  }

  # Firewall rules
  firewall_rules {
    name     = "default"
    start_ip = var.redis_cache_config.firewall_rules.start_ip
    end_ip   = var.redis_cache_config.firewall_rules.end_ip
  }
}

# Outputs
output "storage_account_name" {
  value = azurerm_storage_account.document_storage.name
  description = "The name of the storage account"
}

output "storage_account_primary_access_key" {
  value = azurerm_storage_account.document_storage.primary_access_key
  sensitive = true
  description = "The primary access key for the storage account"
}

output "cosmos_db_name" {
  value = azurerm_cosmosdb_account.vector_store.name
  description = "The name of the Cosmos DB account"
}

output "cosmos_db_primary_key" {
  value = azurerm_cosmosdb_account.vector_store.primary_key
  sensitive = true
  description = "The primary key for the Cosmos DB account"
}

output "cosmos_db_connection_strings" {
  value = azurerm_cosmosdb_account.vector_store.connection_strings
  sensitive = true
  description = "The connection strings for the Cosmos DB account"
}

output "redis_cache_name" {
  value = azurerm_redis_cache.cache.name
  description = "The name of the Redis Cache instance"
}

output "redis_cache_primary_connection_string" {
  value = azurerm_redis_cache.cache.primary_connection_string
  sensitive = true
  description = "The primary connection string for the Redis Cache instance"
}