# Azure Database Module for AI-powered Product Catalog Search System
# Provider versions
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

# Local variables for resource naming and configuration
locals {
  sql_server_name         = "${var.environment}-sql-server-${random_string.suffix.result}"
  sql_database_name       = "${var.environment}-sql-db-${random_string.suffix.result}"
  cosmos_account_name     = "${var.environment}-cosmos-${random_string.suffix.result}"
  diagnostic_setting_name = "${var.environment}-db-diag"
  backup_retention_days   = 35
  geo_redundant_backup_enabled = true
}

# Random string generator for unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
  min_numeric = 2
}

# Azure SQL Server with enhanced security
resource "azurerm_mssql_server" "main" {
  name                         = local.sql_server_name
  resource_group_name         = var.resource_group_name
  location                    = var.location
  version                     = var.sql_server_config.version
  administrator_login         = var.sql_server_config.admin_username
  administrator_login_password = var.sql_server_config.admin_password
  minimum_tls_version         = "1.2"
  public_network_access_enabled = false

  azuread_administrator {
    login_username = var.sql_server_config.ad_admin_username
    object_id     = var.sql_server_config.ad_admin_object_id
    tenant_id     = var.sql_server_config.tenant_id
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# Azure SQL Database with high availability configuration
resource "azurerm_mssql_database" "main" {
  name                = local.sql_database_name
  server_id           = azurerm_mssql_server.main.id
  sku_name            = var.sql_database_config.sku_name
  max_size_gb         = var.sql_database_config.max_size_gb
  zone_redundant      = true
  storage_account_type = "Premium_ZRS"
  read_scale          = true
  geo_backup_enabled  = local.geo_redundant_backup_enabled
  
  short_term_retention_policy {
    retention_days = 7
    backup_interval_in_hours = 24
  }

  long_term_retention_policy {
    weekly_retention  = "P4W"
    monthly_retention = "P12M"
    yearly_retention  = "P5Y"
    week_of_year     = 1
  }

  tags = var.tags
}

# Cosmos DB Account for vector embeddings storage
resource "azurerm_cosmosdb_account" "main" {
  name                = local.cosmos_account_name
  resource_group_name = var.resource_group_name
  location            = var.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"
  
  enable_automatic_failover = true
  enable_multiple_write_locations = true
  
  consistency_policy {
    consistency_level       = var.cosmos_db_config.consistency_policy.level
    max_interval_in_seconds = var.cosmos_db_config.consistency_policy.max_interval_in_seconds
    max_staleness_prefix    = var.cosmos_db_config.consistency_policy.max_staleness_prefix
  }

  dynamic "geo_location" {
    for_each = var.cosmos_db_config.geo_locations
    content {
      location          = geo_location.value.location
      failover_priority = geo_location.value.failover_priority
      zone_redundant    = geo_location.value.zone_redundant
    }
  }

  capabilities {
    name = "EnableServerless"
  }

  capabilities {
    name = "EnableAggregationPipeline"
  }

  capabilities {
    name = "MongoEnableDocLevelTTL"
  }

  backup {
    type                = "Periodic"
    interval_in_minutes = 240
    retention_in_hours  = 8
    storage_redundancy  = "Geo"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# Private endpoints for secure database access
resource "azurerm_private_endpoint" "database" {
  for_each = {
    sql = {
      name = "sql"
      private_service_connection = {
        name = "sqldbconnection"
        is_manual_connection = false
        private_connection_resource_id = azurerm_mssql_server.main.id
        subresource_names = ["sqlServer"]
      }
    }
    cosmos = {
      name = "cosmos"
      private_service_connection = {
        name = "cosmosdbconnection"
        is_manual_connection = false
        private_connection_resource_id = azurerm_cosmosdb_account.main.id
        subresource_names = ["SQL"]
      }
    }
  }

  name                = "${var.environment}-${each.value.name}-pe"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = each.value.private_service_connection.name
    is_manual_connection          = each.value.private_service_connection.is_manual_connection
    private_connection_resource_id = each.value.private_service_connection.private_connection_resource_id
    subresource_names             = each.value.private_service_connection.subresource_names
  }

  private_dns_zone_group {
    name = "default"
    private_dns_zone_ids = each.value.name == "sql" ? [var.private_dns_zone_ids.sql] : [var.private_dns_zone_ids.cosmos]
  }

  tags = var.tags
}

# Outputs
output "sql_server_id" {
  value       = azurerm_mssql_server.main.id
  description = "Resource ID of the provisioned SQL Server"
}

output "cosmos_db_id" {
  value       = azurerm_cosmosdb_account.main.id
  description = "Resource ID of the provisioned Cosmos DB account"
}

output "sql_database_name" {
  value       = azurerm_mssql_database.main.name
  description = "Name of the provisioned SQL Database"
}

output "cosmos_connection_strings" {
  value       = azurerm_cosmosdb_account.main.connection_strings
  description = "Connection strings for the Cosmos DB account"
  sensitive   = true
}