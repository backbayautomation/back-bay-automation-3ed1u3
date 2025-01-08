# AKS Cluster Configuration
aks_config = {
  cluster_name         = "aks-catalog-search-prod"
  kubernetes_version   = "1.25.6"
  system_node_pool = {
    name                = "systempool"
    vm_size            = "Standard_D4s_v3"
    node_count         = 3
    min_count          = 3
    max_count          = 5
    enable_auto_scaling = true
    availability_zones  = [1, 2, 3]
    os_disk_size_gb    = 128
    max_pods           = 110
  }
  app_node_pool = {
    name                = "apppool"
    vm_size            = "Standard_D8s_v3"
    node_count         = 5
    min_count          = 3
    max_count          = 10
    enable_auto_scaling = true
    availability_zones  = [1, 2, 3]
    os_disk_size_gb    = 256
    max_pods           = 110
  }
  gpu_node_pool = {
    name                = "gpupool"
    vm_size            = "Standard_NC6s_v3"
    node_count         = 2
    min_count          = 2
    max_count          = 4
    enable_auto_scaling = true
    availability_zones  = [1, 2]
    os_disk_size_gb    = 256
    max_pods           = 50
  }
}

# Database Configuration
database_config = {
  sql = {
    name                            = "sql-catalog-search-prod"
    sku                            = "BusinessCritical"
    tier                           = "BC_Gen5"
    family                         = "Gen5"
    capacity                       = 8
    storage_size_gb                = 512
    geo_redundant_backup           = true
    zone_redundant                 = true
    backup_retention_days          = 35
    enable_threat_detection        = true
    enable_vulnerability_assessment = true
    maintenance_window = {
      day_of_week  = 6
      start_hour   = 22
      start_minute = 0
    }
  }
  cosmos = {
    name                            = "cosmos-catalog-search-prod"
    consistency_level               = "Session"
    enable_automatic_failover       = true
    enable_multiple_write_locations = true
    enable_free_tier                = false
    backup_type                     = "Continuous"
    backup_interval_in_minutes      = 240
    backup_retention_in_hours       = 720
    enable_analytical_storage       = true
    total_throughput_limit         = 100000
  }
}

# Storage Configuration
storage_config = {
  account_name                  = "stcatalogsearchprod"
  account_tier                 = "Premium"
  account_replication_type     = "ZRS"
  enable_https_traffic_only    = true
  min_tls_version             = "TLS1_2"
  allow_blob_public_access     = false
  blob_soft_delete_retention_days = 30
  enable_versioning           = true
  enable_hierarchical_namespace = true
  network_rules = {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = []
    virtual_network_subnet_ids = []
  }
  containers = {
    documents = {
      name               = "documents"
      access_type        = "private"
      enable_immutability = true
    }
    processed = {
      name               = "processed"
      access_type        = "private"
      enable_immutability = false
    }
  }
}

# Network Configuration
network_config = {
  vnet_name          = "vnet-catalog-search-prod"
  vnet_address_space = ["10.0.0.0/16"]
  subnets = {
    aks = {
      name                                          = "snet-aks"
      address_prefix                                = "10.0.0.0/22"
      service_endpoints                             = ["Microsoft.Sql", "Microsoft.Storage"]
      enforce_private_link_endpoint_network_policies = true
    }
    db = {
      name                                          = "snet-db"
      address_prefix                                = "10.0.4.0/24"
      service_endpoints                             = ["Microsoft.Sql"]
      enforce_private_link_endpoint_network_policies = true
    }
    private_endpoints = {
      name                                          = "snet-pe"
      address_prefix                                = "10.0.5.0/24"
      enforce_private_link_endpoint_network_policies = true
    }
  }
  network_security_rules = {
    allow_azure_lb         = true
    allow_azure_monitor    = true
    deny_internet_outbound = true
    allow_gateway_manager  = true
    allow_load_balancer    = true
  }
  ddos_protection_plan = {
    enable = true
    name   = "ddos-catalog-search-prod"
  }
}

# Monitoring Configuration
monitoring_config = {
  workspace_name            = "log-catalog-search-prod"
  retention_in_days        = 90
  enable_container_insights = true
  enable_vm_insights       = true
  daily_quota_gb           = 100
  alerts = {
    cpu_threshold          = 80
    memory_threshold       = 85
    disk_threshold         = 85
    pod_restart_threshold  = 5
    node_ready_threshold   = "5m"
    action_group_name      = "ag-catalog-search-prod"
    action_group_short_name = "ag-prod"
    enable_email_notification = true
    enable_webhook           = true
  }
  diagnostic_settings = {
    retention_policy_days = 90
    enable_logs          = true
    enable_metrics       = true
  }
}

# Resource Tags
tags = {
  Environment         = "Production"
  Project            = "CatalogSearch"
  BusinessUnit       = "Engineering"
  CostCenter         = "10001"
  DataClassification = "Confidential"
  ManagedBy          = "Terraform"
  Backup             = "Required"
  DR                 = "Required"
  Owner              = "platform-team"
  SecurityContact    = "security@company.com"
}