# Core Terraform functionality for variable definitions and validation rules
terraform {
  required_version = "~> 1.0"
}

# Environment identifier with strict validation
variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev/staging/prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Azure region for resource deployment
variable "location" {
  type        = string
  description = "Azure region for resource deployment"
  
  validation {
    condition     = contains(["eastus", "westus", "northeurope", "westeurope"], var.location)
    error_message = "Location must be a supported Azure region: eastus, westus, northeurope, westeurope."
  }
}

# Resource group name with naming convention validation
variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group"
  
  validation {
    condition     = can(regex("^rg-[a-z0-9]+-[a-z0-9]+$", var.resource_group_name))
    error_message = "Resource group name must follow pattern: rg-<service>-<environment> (lowercase alphanumeric)."
  }
}

# AKS cluster configuration
variable "aks_config" {
  type = object({
    cluster_name = string
    kubernetes_version = string
    default_node_pool = object({
      name                = string
      node_count         = number
      vm_size            = string
      enable_auto_scaling = bool
      min_count          = number
      max_count          = number
      os_disk_size_gb    = number
    })
    gpu_node_pool = object({
      name                = string
      node_count         = number
      vm_size            = string
      enable_auto_scaling = bool
      min_count          = number
      max_count          = number
    })
    network_profile = object({
      network_plugin     = string
      network_policy    = string
      dns_service_ip    = string
      docker_bridge_cidr = string
      service_cidr      = string
    })
  })
  description = "AKS cluster configuration including node pools and networking"
}

# Database configuration for SQL and Cosmos DB
variable "database_config" {
  type = object({
    sql = object({
      server_name     = string
      database_name   = string
      admin_login     = string
      sku_name        = string
      zone_redundant  = bool
      geo_replication = bool
    })
    cosmos = object({
      account_name    = string
      consistency_level = string
      geo_locations   = list(object({
        location = string
        failover_priority = number
      }))
      capabilities    = list(string)
    })
  })
  description = "Configuration for Azure SQL and Cosmos DB resources"
}

# Storage configuration
variable "storage_config" {
  type = object({
    account_name    = string
    account_tier    = string
    replication_type = string
    containers = list(object({
      name        = string
      access_type = string
    }))
    lifecycle_rules = list(object({
      name         = string
      prefix_match = list(string)
      tier_to_cool_after_days    = number
      tier_to_archive_after_days = number
      delete_after_days          = number
    }))
  })
  description = "Storage account configuration including containers and lifecycle rules"
}

# Network configuration
variable "network_config" {
  type = object({
    vnet_name          = string
    address_space      = list(string)
    subnets = list(object({
      name             = string
      address_prefixes = list(string)
      service_endpoints = list(string)
    }))
    nsg_rules = list(object({
      name                       = string
      priority                   = number
      direction                  = string
      access                     = string
      protocol                   = string
      source_port_range         = string
      destination_port_range    = string
      source_address_prefix     = string
      destination_address_prefix = string
    }))
  })
  description = "Virtual network configuration with subnets and NSG rules"
}

# Monitoring configuration
variable "monitoring_config" {
  type = object({
    workspace_name     = string
    retention_in_days = number
    solutions = list(string)
    metrics_retention_days = number
    alert_rules = list(object({
      name            = string
      description     = string
      severity        = number
      frequency       = string
      window_size     = string
      threshold       = number
      operator        = string
    }))
  })
  description = "Monitoring and observability configuration"
}

# Security configuration
variable "security_config" {
  type = object({
    key_vault = object({
      name                = string
      sku_name            = string
      soft_delete_days    = number
      purge_protection    = bool
    })
    managed_identities = list(object({
      name               = string
      role_assignments   = list(string)
    }))
    encryption = object({
      key_source         = string
      infrastructure_encryption_enabled = bool
    })
  })
  description = "Security configurations for Key Vault and managed identities"
}

# Resource tags
variable "tags" {
  type = map(string)
  description = "Resource tags for organization and tracking"
  
  validation {
    condition     = length(var.tags) >= 3
    error_message = "At least 3 tags are required (environment, owner, cost-center)."
  }
}