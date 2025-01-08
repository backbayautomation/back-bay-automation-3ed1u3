# Development environment Terraform configuration for AI-powered Product Catalog Search System
# Version: 1.0
# Provider versions:
# - terraform: ~> 1.0
# - azurerm: ~> 3.0

# Configure Terraform backend for state management
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state-dev"
    storage_account_name = "stterraformstatedev001"
    container_name      = "tfstate"
    key                = "dev.terraform.tfstate"
    enable_encryption  = true
    enable_versioning  = true
  }
}

# Import main module with development environment configuration
module "main" {
  source = "../../"

  environment         = "dev"
  location           = "eastus"
  resource_group_name = "rg-aicatalog-dev-001"

  # AKS cluster configuration optimized for development
  aks_config = {
    cluster_name        = "aks-aicatalog-dev-001"
    vm_size            = "Standard_D4s_v3"
    node_count         = 2
    max_pods           = 30
    enable_auto_scaling = true
    min_count          = 2
    max_count          = 4
    network_policy     = "azure"
    monitoring_enabled = true
    log_analytics_workspace_id = "log-aicatalog-dev-001"
  }

  # Database configuration for development environment
  database_config = {
    sql_server_name       = "sql-aicatalog-dev-001"
    sql_database_name     = "sqldb-aicatalog-dev-001"
    sql_sku              = "GP_Gen5_2"
    cosmos_account_name   = "cosmos-aicatalog-dev-001"
    cosmos_throughput     = 400
    enable_private_endpoint = true
    backup_retention_days = 7
  }

  # Storage configuration with development-appropriate settings
  storage_config = {
    account_name            = "staicatalogdev001"
    account_tier           = "Standard"
    replication_type       = "LRS"
    enable_https_traffic_only = true
    min_tls_version        = "TLS1_2"
    lifecycle_rules = {
      delete_after_days = 90
    }
  }

  # Network configuration with development security controls
  network_config = {
    vnet_name           = "vnet-aicatalog-dev-001"
    vnet_address_space  = ["10.0.0.0/16"]
    aks_subnet_prefix   = ["10.0.0.0/22"]
    db_subnet_prefix    = ["10.0.4.0/24"]
    enable_ddos_protection = true
    network_security_rules = {
      allow_azure_services = true
      allow_development_ips = true
    }
  }

  # Monitoring configuration for development environment
  monitoring_config = {
    workspace_name          = "log-aicatalog-dev-001"
    retention_days         = 30
    sku                    = "PerGB2018"
    enable_container_insights = true
    enable_vm_insights      = true
    diagnostic_settings = {
      audit_logs_enabled  = true
      metric_logs_enabled = true
    }
  }

  # Security configuration with development-appropriate controls
  security_config = {
    enable_waf               = true
    waf_mode                = "Detection"
    key_vault_enabled       = true
    enable_diagnostic_settings = true
    enable_threat_detection  = true
  }

  # Resource tagging for development environment
  tags = {
    Environment     = "Development"
    Project        = "AI Catalog Search"
    ManagedBy      = "Terraform"
    CostCenter     = "Development"
    SecurityContact = "security@company.com"
  }
}

# Output the development resource group name
output "resource_group_name" {
  value = {
    name = module.main.resource_group_name
  }
  description = "Development resource group name for reference"
}

# Output the development AKS cluster endpoint
output "aks_cluster_endpoint" {
  value = {
    fqdn = module.main.aks_cluster_details.fqdn
  }
  description = "AKS cluster endpoint for development environment"
  sensitive   = true
}

# Output the development database connection strings
output "database_connection_strings" {
  value = {
    sql    = module.main.database_connection_details.sql_connection_string
    cosmos = module.main.database_connection_details.cosmos_connection_string
  }
  description = "Database connection strings for development environment"
  sensitive   = true
}