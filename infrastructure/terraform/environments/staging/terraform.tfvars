# Environment Identification
environment         = "staging"
location           = "eastus2"
resource_group_name = "rg-catalog-search-staging"

# AKS Configuration
aks_config = {
  cluster_name        = "aks-catalog-search-staging"
  kubernetes_version  = "1.26"
  system_node_pool = {
    name                = "systempool"
    vm_size            = "Standard_D4s_v3"
    node_count         = 2
    min_count          = 2
    max_count          = 4
    enable_auto_scaling = true
  }
  app_node_pool = {
    name                = "apppool"
    vm_size            = "Standard_D8s_v3"
    node_count         = 3
    min_count          = 3
    max_count          = 6
    enable_auto_scaling = true
  }
  gpu_node_pool = {
    name                = "gpupool"
    vm_size            = "Standard_NC6s_v3"
    node_count         = 1
    min_count          = 1
    max_count          = 2
    enable_auto_scaling = true
  }
}

# Database Configuration
database_config = {
  sql = {
    name                  = "sql-catalog-search-staging"
    sku                   = "BusinessCritical"
    tier                  = "Standard"
    family                = "Gen5"
    capacity              = 4
    storage_mb            = 256000
    geo_redundant_backup  = false
  }
  cosmos = {
    name                      = "cosmos-catalog-search-staging"
    consistency_level         = "Session"
    enable_automatic_failover = true
    enable_free_tier         = false
    enable_analytical_storage = true
  }
}

# Storage Configuration
storage_config = {
  account_name             = "stcatalogsearchstg"
  account_tier            = "Standard"
  account_replication_type = "ZRS"
  containers = {
    documents = {
      name        = "documents"
      access_type = "private"
    }
    processed = {
      name        = "processed"
      access_type = "private"
    }
  }
}

# Network Configuration
network_config = {
  vnet_name     = "vnet-catalog-search-staging"
  address_space = ["10.1.0.0/16"]
  subnets = {
    aks = {
      name           = "snet-aks"
      address_prefix = "10.1.0.0/22"
    }
    db = {
      name           = "snet-db"
      address_prefix = "10.1.4.0/24"
    }
    private_endpoints = {
      name           = "snet-pe"
      address_prefix = "10.1.5.0/24"
    }
  }
  network_security_rules = {
    allow_https = {
      priority                = 100
      direction               = "Inbound"
      access                  = "Allow"
      protocol               = "Tcp"
      source_port_range      = "*"
      destination_port_range = "443"
    }
  }
}

# Monitoring Configuration
monitoring_config = {
  workspace_name            = "log-catalog-search-staging"
  retention_days           = 30
  enable_container_insights = true
  enable_vm_insights       = true
  alerts = {
    cpu_threshold    = 80
    memory_threshold = 80
    disk_threshold   = 85
  }
}

# Resource Tags
tags = {
  Environment = "Staging"
  Project     = "CatalogSearch"
  Owner       = "Platform Team"
  CostCenter  = "IT-12345"
  ManagedBy   = "Terraform"
}