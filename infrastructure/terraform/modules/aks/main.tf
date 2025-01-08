# Azure Kubernetes Service (AKS) Module Configuration
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

# Random suffix for DNS prefix
resource "random_string" "dns_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Primary AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                            = var.cluster_name
  location                        = var.location
  resource_group_name             = var.resource_group_name
  kubernetes_version              = var.kubernetes_version
  dns_prefix                      = "${var.cluster_name}-${random_string.dns_suffix.result}"
  private_cluster_enabled         = var.private_cluster_config.enable_private_cluster
  private_dns_zone_id            = var.private_cluster_config.private_dns_zone_id
  private_cluster_public_fqdn_enabled = false
  sku_tier                       = "Standard"

  # Default node pool configuration
  default_node_pool {
    name                = var.system_node_pool_config.name
    vm_size             = var.system_node_pool_config.vm_size
    node_count          = var.system_node_pool_config.node_count
    min_count           = var.system_node_pool_config.min_count
    max_count           = var.system_node_pool_config.max_count
    availability_zones  = var.system_node_pool_config.availability_zones
    os_disk_size_gb     = var.system_node_pool_config.os_disk_size_gb
    os_disk_type        = "Managed"
    enable_auto_scaling = var.system_node_pool_config.enable_auto_scaling
    max_pods            = var.system_node_pool_config.max_pods
    node_labels         = var.system_node_pool_config.node_labels
    node_taints         = var.system_node_pool_config.node_taints
    vnet_subnet_id      = var.private_cluster_config.subnet_id
  }

  # Identity configuration
  identity {
    type = "SystemAssigned"
  }

  # Network profile
  network_profile {
    network_plugin     = var.network_profile.network_plugin
    network_policy     = var.network_profile.network_policy
    dns_service_ip     = var.network_profile.dns_service_ip
    docker_bridge_cidr = var.network_profile.docker_bridge_cidr
    service_cidr       = var.network_profile.service_cidr
    load_balancer_sku  = var.network_profile.load_balancer_sku
    outbound_type      = var.network_profile.outbound_type
  }

  # Auto-scaler profile
  auto_scaler_profile {
    balance_similar_node_groups = true
    expander                   = "random"
    max_graceful_termination_sec = "600"
    scale_down_delay_after_add = "10m"
    scale_down_unneeded        = "10m"
  }

  # Azure Monitor integration
  monitor_metrics {
    annotations_allowed = ["*"]
    labels_allowed     = ["*"]
  }

  azure_policy_enabled = true
  http_application_routing_enabled = false

  tags = var.tags
}

# Application Node Pool
resource "azurerm_kubernetes_cluster_node_pool" "app" {
  name                  = var.app_node_pool_config.name
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.app_node_pool_config.vm_size
  node_count           = var.app_node_pool_config.node_count
  min_count            = var.app_node_pool_config.min_count
  max_count            = var.app_node_pool_config.max_count
  availability_zones   = var.app_node_pool_config.availability_zones
  os_disk_size_gb      = var.app_node_pool_config.os_disk_size_gb
  os_disk_type         = "Managed"
  enable_auto_scaling  = var.app_node_pool_config.enable_auto_scaling
  max_pods             = var.app_node_pool_config.max_pods
  node_labels          = var.app_node_pool_config.node_labels
  node_taints          = var.app_node_pool_config.node_taints
  vnet_subnet_id       = var.private_cluster_config.subnet_id

  tags = var.tags
}

# GPU Node Pool for OCR Processing
resource "azurerm_kubernetes_cluster_node_pool" "gpu" {
  name                  = var.gpu_node_pool_config.name
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.gpu_node_pool_config.vm_size
  node_count           = var.gpu_node_pool_config.node_count
  min_count            = var.gpu_node_pool_config.min_count
  max_count            = var.gpu_node_pool_config.max_count
  availability_zones   = var.gpu_node_pool_config.availability_zones
  os_disk_size_gb      = var.gpu_node_pool_config.os_disk_size_gb
  os_disk_type         = "Managed"
  enable_auto_scaling  = var.gpu_node_pool_config.enable_auto_scaling
  max_pods             = var.gpu_node_pool_config.max_pods
  node_labels          = var.gpu_node_pool_config.node_labels
  node_taints          = var.gpu_node_pool_config.node_taints
  vnet_subnet_id       = var.private_cluster_config.subnet_id

  tags = var.tags
}

# Outputs
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

output "node_resource_group" {
  value       = azurerm_kubernetes_cluster.main.node_resource_group
  description = "The resource group containing AKS cluster nodes"
}