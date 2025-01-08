# Core resource variables
variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where storage resources will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region for storage resource deployment"
}

# Storage Account configuration
variable "storage_account_config" {
  type = object({
    account_tier                    = string
    account_replication_type        = string
    enable_https_traffic_only       = bool
    min_tls_version                = string
    allow_nested_items_to_be_public = bool
    versioning_enabled             = bool
    delete_retention_days          = number
    lifecycle_rules = object({
      cool_tier_days    = number
      archive_tier_days = number
      delete_after_days = number
    })
    network_rules = object({
      default_action             = string
      bypass                     = list(string)
      ip_rules                  = list(string)
      virtual_network_subnet_ids = list(string)
    })
    blob_properties = object({
      container_delete_retention_days = number
      cors_rules = object({
        allowed_headers     = list(string)
        allowed_methods     = list(string)
        allowed_origins     = list(string)
        exposed_headers     = list(string)
        max_age_in_seconds  = number
      })
    })
  })
  description = "Comprehensive configuration for Azure Storage Account including security, performance, and compliance settings"

  default = {
    account_tier                    = "Standard"
    account_replication_type        = "ZRS"
    enable_https_traffic_only       = true
    min_tls_version                = "TLS1_2"
    allow_nested_items_to_be_public = false
    versioning_enabled             = true
    delete_retention_days          = 30
    lifecycle_rules = {
      cool_tier_days    = 90
      archive_tier_days = 365
      delete_after_days = 730
    }
    network_rules = {
      default_action             = "Deny"
      bypass                     = ["AzureServices"]
      ip_rules                  = []
      virtual_network_subnet_ids = []
    }
    blob_properties = {
      container_delete_retention_days = 30
      cors_rules = {
        allowed_headers     = ["*"]
        allowed_methods     = ["GET", "HEAD"]
        allowed_origins     = ["https://*.yourdomain.com"]
        exposed_headers     = ["*"]
        max_age_in_seconds  = 3600
      }
    }
  }

  validation {
    condition     = contains(["Standard", "Premium"], var.storage_account_config.account_tier)
    error_message = "Account tier must be either Standard or Premium"
  }
}

# Cosmos DB configuration
variable "cosmos_db_config" {
  type = object({
    offer_type                     = string
    kind                          = string
    enable_automatic_failover     = bool
    consistency_level             = string
    enable_serverless             = bool
    enable_multiple_write_locations = bool
    backup_policy = object({
      type                 = string
      interval_in_minutes  = number
      retention_in_hours   = number
    })
    vector_search_config = object({
      dimension            = number
      similarity_algorithm = string
      index_type          = string
      num_lists           = number
      similarity_threshold = number
    })
    performance_config = object({
      max_throughput            = number
      auto_scale               = bool
      max_staleness_prefix     = number
      max_interval_in_seconds  = number
    })
  })
  description = "Detailed configuration for Cosmos DB optimized for vector storage and similarity search"

  default = {
    offer_type                     = "Standard"
    kind                          = "GlobalDocumentDB"
    enable_automatic_failover     = true
    consistency_level             = "Session"
    enable_serverless             = true
    enable_multiple_write_locations = true
    backup_policy = {
      type                 = "Periodic"
      interval_in_minutes  = 240
      retention_in_hours   = 720
    }
    vector_search_config = {
      dimension            = 1536
      similarity_algorithm = "cosine"
      index_type          = "IVF"
      num_lists           = 1000
      similarity_threshold = 0.8
    }
    performance_config = {
      max_throughput            = 4000
      auto_scale               = true
      max_staleness_prefix     = 100000
      max_interval_in_seconds  = 5
    }
  }
}

# Redis Cache configuration
variable "redis_cache_config" {
  type = object({
    sku_name              = string
    family               = string
    capacity             = number
    enable_non_ssl_port  = bool
    minimum_tls_version  = string
    maxmemory_reserved   = string
    maxmemory_delta      = string
    maxmemory_policy     = string
    shard_count          = number
    cluster_config = object({
      enabled                  = bool
      max_replicas_per_master = number
    })
    patch_schedule = object({
      day_of_week    = string
      start_hour_utc = number
    })
    persistence_config = object({
      enabled               = bool
      frequency_in_minutes = number
    })
    firewall_rules = object({
      start_ip = string
      end_ip   = string
    })
  })
  description = "Advanced configuration for Redis Cache including memory management and performance settings"

  default = {
    sku_name              = "Premium"
    family               = "P"
    capacity             = 1
    enable_non_ssl_port  = false
    minimum_tls_version  = "1.2"
    maxmemory_reserved   = "2"
    maxmemory_delta      = "2"
    maxmemory_policy     = "allkeys-lru"
    shard_count          = 2
    cluster_config = {
      enabled                  = true
      max_replicas_per_master = 1
    }
    patch_schedule = {
      day_of_week    = "Sunday"
      start_hour_utc = 2
    }
    persistence_config = {
      enabled               = true
      frequency_in_minutes = 60
    }
    firewall_rules = {
      start_ip = "0.0.0.0"
      end_ip   = "0.0.0.0"
    }
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for organization and billing"
  default     = {}
}