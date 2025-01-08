# Terraform configuration for staging environment
# Version: 1.0
# Provider Versions:
# - terraform: ~> 1.0
# - azurerm: ~> 3.0

# Configure Terraform backend for state management
terraform {
  required_version = "~> 1.0"
  
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstaging"
    container_name      = "tfstate"
    key                = "staging.terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Configure Azure provider
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Main module configuration for staging environment
module "main" {
  source = "../../"

  # Environment configuration
  environment           = "staging"
  location             = "eastus2"
  resource_group_name  = "rg-catalog-search-staging"

  # AKS configuration
  aks_config = {
    cluster_name        = "aks-catalog-search-staging"
    node_count         = 3
    vm_size            = "Standard_D4s_v3"
    kubernetes_version = "1.25"
    enable_auto_scaling = true
    min_node_count     = 3
    max_node_count     = 5
    network_plugin     = "azure"
    network_policy     = "calico"
    service_cidr       = "172.16.0.0/16"
    dns_service_ip     = "172.16.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
    pod_security_policies = true
    monitoring_enabled = true
  }

  # Database configuration
  database_config = {
    sql = {
      name                    = "sql-catalog-search-staging"
      tier                    = "BusinessCritical"
      family                  = "Gen5"
      capacity                = 8
      geo_redundant_backup    = true
      retention_days          = 7
      auditing_enabled        = true
      threat_detection_enabled = true
    }
    cosmos = {
      name                     = "cosmos-catalog-search-staging"
      consistency_level        = "Session"
      enable_automatic_failover = true
      backup_interval_minutes   = 240
      backup_retention_hours    = 24
    }
  }

  # Storage configuration
  storage_config = {
    account_name                  = "stcatalogsearchstg"
    account_tier                  = "Standard"
    replication_type             = "ZRS"
    enable_hierarchical_namespace = true
    enable_https_traffic_only    = true
    min_tls_version              = "TLS1_2"
    network_rules = {
      default_action             = "Deny"
      ip_rules                   = []
      virtual_network_subnet_ids = []
    }
  }

  # Network configuration
  network_config = {
    vnet_name     = "vnet-catalog-search-staging"
    address_space = ["10.1.0.0/16"]
    subnets = {
      aks = {
        name                = "snet-aks"
        address_prefix      = "10.1.0.0/22"
        service_endpoints   = ["Microsoft.Sql", "Microsoft.Storage"]
        enforce_private_link_endpoint_network_policies = true
      }
      db = {
        name                = "snet-db"
        address_prefix      = "10.1.4.0/24"
        service_endpoints   = ["Microsoft.Sql"]
        enforce_private_link_endpoint_network_policies = true
      }
    }
    nsg_rules = {
      allow_azure_lb         = true
      allow_internet_outbound = true
      allow_vnet_inbound     = true
      allow_gateway_manager  = true
    }
  }

  # Monitoring configuration
  monitoring_config = {
    workspace_name           = "log-catalog-search-staging"
    retention_days          = 30
    enable_container_insights = true
    enable_application_insights = true
    diagnostic_settings = {
      enabled        = true
      retention_days = 30
    }
    alerts = {
      cpu_threshold         = 80
      memory_threshold      = 80
      pod_restart_threshold = 5
    }
  }

  # Resource tags
  tags = {
    Environment         = "Staging"
    Project            = "Catalog-Search"
    Owner              = "Platform-Team"
    CostCenter         = "IT-12345"
    SecurityLevel      = "High"
    DataClassification = "Confidential"
  }
}

# Output definitions
output "resource_group_name" {
  value       = module.main.resource_group_name
  description = "The name of the staging resource group"
}

output "aks_cluster_id" {
  value       = module.main.aks_cluster_details.id
  description = "The ID of the staging AKS cluster"
  sensitive   = true
}

output "database_connection_strings" {
  value = {
    sql    = module.main.database_connection_details.sql_connection_string
    cosmos = module.main.database_connection_details.cosmos_connection_string
  }
  description = "Database connection strings for the staging environment"
  sensitive   = true
}