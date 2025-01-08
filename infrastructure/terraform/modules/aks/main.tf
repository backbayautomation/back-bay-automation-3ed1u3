# Azure Resource Manager provider configuration
# Provider version: ~> 3.0
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

# Random string for DNS prefix
resource "random_string" "dns_prefix" {
  length  = 8
  special = false
  upper   = false
}

# Primary AKS cluster resource
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  kubernetes_version  = var.kubernetes_version
  dns_prefix         = "${var.cluster_name}-${random_string.dns_prefix.result}"
  
  # Private cluster configuration
  private_cluster_enabled = var.private_cluster_config.enable_private_cluster
  private_dns_zone_id    = var.private_cluster_config.private_dns_zone_id
  
  # Default node pool configuration
  default_node_pool {
    name                = var.system_node_pool_config.name
    vm_size            = var.system_node_pool_config.vm_size
    enable_auto_scaling = var.system_node_pool_config.enable_auto_scaling
    node_count         = var.system_node_pool_config.node_count
    min_count          = var.system_node_pool_config.min_count
    max_count          = var.system_node_pool_config.max_count
    os_disk_size_gb    = var.system_node_pool_config.os_disk_size_gb
    max_pods           = var.system_node_pool_config.max_pods
    node_labels        = var.system_node_pool_config.node_labels
    node_taints        = var.system_node_pool_config.node_taints
    vnet_subnet_id     = var.private_cluster_config.private_endpoint_subnet_id
    
    # Enhanced security settings
    enable_node_public_ip = false
    type                 = "VirtualMachineScaleSets"
    os_disk_type        = "Managed"
  }

  # Network profile configuration
  network_profile {
    network_plugin     = var.network_profile.network_plugin
    network_policy     = var.network_profile.network_policy
    dns_service_ip     = var.network_profile.dns_service_ip
    docker_bridge_cidr = var.network_profile.docker_bridge_cidr
    service_cidr       = var.network_profile.service_cidr
    load_balancer_sku  = var.network_profile.load_balancer_sku
    outbound_type      = var.network_profile.outbound_type
  }

  # Identity configuration
  identity {
    type = "SystemAssigned"
  }

  # Monitoring configuration
  monitor_metrics {
    annotations_allowed = ["*"]
    labels_allowed     = ["*"]
  }

  oms_agent {
    log_analytics_workspace_id = var.monitoring_config.log_analytics_workspace_id
  }

  # Auto-scaler profile
  auto_scaler_profile {
    balance_similar_node_groups = true
    expander                   = "random"
    max_graceful_termination_sec = "600"
    scale_down_delay_after_add = "10m"
    scale_down_unneeded        = "10m"
  }

  tags = var.tags
}

# Application node pool
resource "azurerm_kubernetes_cluster_node_pool" "app" {
  name                  = var.app_node_pool_config.name
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.app_node_pool_config.vm_size
  enable_auto_scaling  = var.app_node_pool_config.enable_auto_scaling
  node_count          = var.app_node_pool_config.node_count
  min_count           = var.app_node_pool_config.min_count
  max_count           = var.app_node_pool_config.max_count
  os_disk_size_gb     = var.app_node_pool_config.os_disk_size_gb
  max_pods            = var.app_node_pool_config.max_pods
  node_labels         = var.app_node_pool_config.node_labels
  node_taints         = var.app_node_pool_config.node_taints
  vnet_subnet_id      = var.private_cluster_config.private_endpoint_subnet_id

  # Enhanced security settings
  enable_node_public_ip = false
  os_disk_type         = "Managed"
  
  tags = var.tags
}

# GPU node pool for OCR and AI workloads
resource "azurerm_kubernetes_cluster_node_pool" "gpu" {
  name                  = var.gpu_node_pool_config.name
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.gpu_node_pool_config.vm_size
  enable_auto_scaling  = var.gpu_node_pool_config.enable_auto_scaling
  node_count          = var.gpu_node_pool_config.node_count
  min_count           = var.gpu_node_pool_config.min_count
  max_count           = var.gpu_node_pool_config.max_count
  os_disk_size_gb     = var.gpu_node_pool_config.os_disk_size_gb
  max_pods            = var.gpu_node_pool_config.max_pods
  node_labels         = var.gpu_node_pool_config.node_labels
  node_taints         = var.gpu_node_pool_config.node_taints
  vnet_subnet_id      = var.private_cluster_config.private_endpoint_subnet_id

  # Enhanced security settings
  enable_node_public_ip = false
  os_disk_type         = "Managed"
  
  tags = var.tags
}

# Outputs for use in other modules
output "cluster_id" {
  value       = azurerm_kubernetes_cluster.main.id
  description = "The ID of the AKS cluster"
}

output "kube_config" {
  value = {
    raw_kube_config           = azurerm_kubernetes_cluster.main.kube_config_raw
    raw_kube_admin_config     = azurerm_kubernetes_cluster.main.kube_admin_config_raw
    host                      = azurerm_kubernetes_cluster.main.kube_config[0].host
    client_certificate        = azurerm_kubernetes_cluster.main.kube_config[0].client_certificate
    client_key               = azurerm_kubernetes_cluster.main.kube_config[0].client_key
    cluster_ca_certificate   = azurerm_kubernetes_cluster.main.kube_config[0].cluster_ca_certificate
  }
  sensitive   = true
  description = "Kubernetes configuration for cluster access"
}