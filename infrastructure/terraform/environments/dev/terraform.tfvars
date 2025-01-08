# Development environment identifier
environment = "dev"

# Azure region for development resources
location = "eastus"

# Resource group name
resource_group_name = "rg-catalog-search-dev"

# AKS cluster configuration optimized for development
aks_config = {
  cluster_name        = "aks-catalog-search-dev"
  kubernetes_version  = "1.26"
  
  # System node pool for cluster management
  system_node_pool = {
    name                = "systempool"
    vm_size            = "Standard_D2s_v3"
    node_count         = 1
    min_count          = 1
    max_count          = 3
    enable_auto_scaling = true
  }
  
  # Application node pool for general workloads
  app_node_pool = {
    name                = "apppool"
    vm_size            = "Standard_D4s_v3"
    node_count         = 1
    min_count          = 1
    max_count          = 5
    enable_auto_scaling = true
  }
  
  # GPU node pool for AI/ML workloads
  gpu_node_pool = {
    name                = "gpupool"
    vm_size            = "Standard_NC6s_v3"
    node_count         = 1
    min_count          = 0
    max_count          = 2
    enable_auto_scaling = true
  }
}

# Database configurations
database_config = {
  sql = {
    name        = "sql-catalog-search-dev"
    tier        = "Standard"
    size        = "S1"
    max_size_gb = 50
  }
  cosmos = {
    name              = "cosmos-catalog-search-dev"
    consistency_level = "Session"
    max_throughput    = 1000
  }
}

# Storage configurations
storage_config = {
  account_name     = "stcatalogsearchdev"
  account_tier     = "Standard"
  replication_type = "LRS"
  containers = {
    documents  = "documents"
    embeddings = "embeddings"
    cache      = "cache"
  }
}

# Network configurations
network_config = {
  vnet_name     = "vnet-catalog-search-dev"
  address_space = ["10.0.0.0/16"]
  subnets = {
    aks = {
      name           = "snet-aks"
      address_prefix = "10.0.0.0/22"
    }
    db = {
      name           = "snet-db"
      address_prefix = "10.0.4.0/24"
    }
  }
}

# Monitoring configuration
monitoring_config = {
  workspace_name              = "log-catalog-search-dev"
  retention_days             = 30
  enable_container_insights  = true
  enable_application_insights = true
}

# Resource tags
tags = {
  Environment = "Development"
  Project     = "Catalog-Search"
  Owner       = "DevTeam"
  CostCenter  = "Dev-001"
}