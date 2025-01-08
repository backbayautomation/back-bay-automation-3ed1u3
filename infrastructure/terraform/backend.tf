# Backend configuration for Terraform state management in Azure
# Version: ~> 1.0
terraform {
  # Azure Storage Account backend configuration with enhanced security
  backend "azurerm" {
    # Resource group and storage account configuration
    resource_group_name           = "tfstate-${var.environment}"
    storage_account_name          = "tfstate${var.environment}${random_string.unique.result}"
    container_name               = "tfstate"
    key                         = "terraform.tfstate"

    # Authentication and security settings
    use_msi                     = true
    subscription_id             = var.subscription_id
    tenant_id                   = var.tenant_id
    environment                 = "public"
    min_tls_version            = "TLS1_2"
    enable_https_traffic_only   = true
    allow_nested_items_to_be_public = false

    # Network security rules
    network_rules {
      default_action             = "Deny"
      ip_rules                  = []
      virtual_network_subnet_ids = []
    }

    # State locking configuration (using Azure Storage lease mechanism)
    lock_timeout                = "5m"

    # Additional security headers
    blob_properties {
      versioning_enabled        = true
      change_feed_enabled       = true
      delete_retention_policy {
        days                    = 30
      }
      container_delete_retention_policy {
        days                    = 30
      }
    }

    # Encryption configuration
    encryption {
      services {
        blob {
          enabled              = true
          key_type            = "Account"
        }
        file {
          enabled              = true
          key_type            = "Account"
        }
      }
      key_source              = "Microsoft.Storage"
    }
  }
}

# Random string resource for unique storage account naming
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
}

# Data block to reference the current Azure subscription
data "azurerm_subscription" "current" {}

# Data block to reference the current client configuration
data "azurerm_client_config" "current" {}

# Storage account diagnostic settings
resource "azurerm_monitor_diagnostic_setting" "tfstate_storage" {
  name                       = "tfstate-diagnostics"
  target_resource_id        = azurerm_storage_account.tfstate.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  log {
    category = "StorageRead"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  log {
    category = "StorageWrite"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "Transaction"
    enabled  = true
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Private endpoint for secure access to storage account
resource "azurerm_private_endpoint" "tfstate_storage" {
  name                = "pe-tfstate-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "psc-tfstate-${var.environment}"
    private_connection_resource_id = azurerm_storage_account.tfstate.id
    is_manual_connection          = false
    subresource_names            = ["blob"]
  }

  private_dns_zone_group {
    name                = "privatelink-blob-core-windows-net"
    private_dns_zone_ids = [var.private_dns_zone_id]
  }
}

# RBAC role assignment for managed identity
resource "azurerm_role_assignment" "tfstate_storage" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}