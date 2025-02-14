# Core Terraform functionality for variable definitions
# terraform ~> 1.0

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where database resources will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where database resources will be deployed"
}

variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "sql_server_config" {
  type = object({
    name                         = string
    version                     = string
    administrator_login         = string
    administrator_login_password = string
    minimum_tls_version         = string
    public_network_access       = bool
    identity_type              = string
    azuread_authentication     = bool
    audit_retention_days       = number
    audit_storage_account_id   = string
    firewall_rules = list(object({
      name             = string
      start_ip_address = string
      end_ip_address   = string
    }))
  })
  description = "Configuration for Azure SQL Server including version, admin credentials, security settings, and auditing configuration"
}

variable "sql_database_config" {
  type = object({
    name                = string
    sku_name            = string
    max_size_gb         = number
    zone_redundant      = bool
    read_scale          = bool
    geo_backup_enabled  = bool
    backup_retention_days = number
    auto_pause_delay_in_minutes = number
    min_capacity        = number
    ledger_enabled      = bool
    threat_detection_policy = object({
      state                      = string
      email_account_admins      = bool
      email_addresses           = list(string)
      retention_days           = number
      storage_account_access_key = string
      storage_endpoint          = string
    })
  })
  description = "Configuration for Azure SQL Database including SKU, size, high availability, and backup settings"
}

variable "cosmos_db_config" {
  type = object({
    name                      = string
    offer_type               = string
    kind                     = string
    consistency_level        = string
    max_staleness_prefix    = number
    max_interval_in_seconds = number
    failover_priority       = number
    enable_automatic_failover = bool
    enable_free_tier         = bool
    enable_analytical_storage = bool
    backup = object({
      type                = string
      interval_in_minutes = number
      retention_in_hours  = number
      storage_redundancy  = string
    })
    networking = object({
      enable_private_endpoint = bool
      ip_range_filter        = string
      enable_multiple_write_locations = bool
      virtual_network_rules = list(object({
        id                   = string
        ignore_missing_vnet_service_endpoint = bool
      }))
    })
    capabilities = list(string)
  })
  description = "Configuration for Cosmos DB including consistency level, geo-replication, backup, and network settings"
}

variable "subnet_id" {
  type        = string
  description = "ID of the subnet where private endpoints will be created for secure database access"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for organization and billing purposes"
  default     = {}
}