# Production environment Terraform configuration for AI-powered Product Catalog Search System
# Version: 1.0
# Provider versions:
# - terraform: ~> 1.0
# - azurerm: ~> 3.0

terraform {
  required_version = "~> 1.0"
  
  # Production state management in Azure Storage
  backend "azurerm" {
    resource_group_name  = "tfstate-prod-rg"
    storage_account_name = "tfstateprodsa"
    container_name      = "tfstate"
    key                = "prod.terraform.tfstate"
    subscription_id    = "${var.subscription_id}"
    tenant_id         = "${var.tenant_id}"
    use_msi           = true
  }
}

# Production environment infrastructure module
module "main" {
  source = "../../"

  environment = "prod"
  
  # Multi-region configuration
  location = {
    primary   = "eastus2"
    secondary = "westus2"
  }

  resource_group_name = "product-search-prod-rg"

  # Production AKS configuration with GPU support
  aks_config = {
    cluster_name = "aks-prod-cluster"
    node_count   = 5
    vm_size     = "Standard_D8s_v3"
    availability_zones = ["1", "2", "3"]
    
    gpu_node_pool = {
      enabled    = true
      vm_size    = "Standard_NC6s_v3"
      node_count = 2
      zones      = ["1", "2"]
    }
    
    auto_scaling = {
      enabled   = true
      min_count = 3
      max_count = 10
    }
  }

  # Production database configuration
  database_config = {
    sql = {
      sku                  = "BusinessCritical"
      tier                 = "BC_Gen5"
      family               = "Gen5"
      capacity             = 8
      geo_replication      = true
      failover_group       = true
      backup_retention_days = 35
    }
    
    cosmos = {
      throughput           = 10000
      consistency_level    = "Session"
      geo_replication      = true
      multi_region_writes  = true
      availability_zones   = true
    }
  }

  # Production storage configuration
  storage_config = {
    replication_type      = "GZRS"
    tier                  = "Premium"
    access_tier          = "Hot"
    versioning           = true
    soft_delete_retention = 30
    
    network_rules = {
      default_action = "Deny"
      bypass         = ["AzureServices"]
      ip_rules       = []
      virtual_network_subnet_ids = []
    }
  }

  # Production network configuration
  network_config = {
    vnet_address_space = "10.0.0.0/16"
    subnet_prefixes    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
    
    network_security_rules = {
      inbound_rules  = []
      outbound_rules = []
    }
    
    ddos_protection   = true
    private_endpoints = true
  }

  # Production monitoring configuration
  monitoring_config = {
    retention_days = 90
    sku            = "PerGB2018"
    
    diagnostic_settings = {
      enabled = true
      retention_policy = {
        enabled = true
        days    = 90
      }
    }
    
    alerts = {
      enabled       = true
      action_groups = []
    }
  }

  # Production security configuration
  security_config = {
    key_vault = {
      sku              = "premium"
      soft_delete      = true
      purge_protection = true
    }
    
    ddos_protection = true
    waf_policy = {
      enabled = true
      mode    = "Prevention"
    }
  }

  # Production resource tagging
  tags = {
    Environment         = "Production"
    Project            = "AI-Catalog-Search"
    CostCenter         = "IT-123"
    DataClassification = "Confidential"
    DR                 = "Critical"
    ComplianceRequired = "Yes"
  }
}

# Production environment outputs
output "resource_group_name" {
  value       = module.main.resource_group_name
  description = "Production resource group name"
}

output "aks_cluster_id" {
  value       = module.main.aks_cluster_id
  description = "Production AKS cluster ID"
  sensitive   = true
}

output "database_connection_strings" {
  value = {
    sql    = module.main.database_connection_strings.sql
    cosmos = module.main.database_connection_strings.cosmos
  }
  description = "Production database connection strings"
  sensitive   = true
}

output "monitoring_workspace_id" {
  value       = module.main.monitoring_workspace_id
  description = "Production monitoring workspace ID"
  sensitive   = true
}