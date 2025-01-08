# Terraform AKS Module Variables
# Version: hashicorp/terraform ~> 1.0

# Resource Group Configuration
variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where AKS cluster will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where AKS cluster will be deployed"
}

# Cluster Configuration
variable "cluster_name" {
  type        = string
  description = "Name of the Azure Kubernetes Service cluster"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the AKS cluster"
  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be in the format: X.Y.Z"
  }
}

# System Node Pool Configuration
variable "system_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    node_count         = number
    min_count          = number
    max_count          = number
    availability_zones = list(string)
    os_disk_size_gb    = number
    max_pods           = number
    enable_auto_scaling = bool
    node_labels        = map(string)
    node_taints        = list(string)
  })
  description = "Configuration for the system node pool"
  default = {
    name                = "system"
    vm_size            = "Standard_D4s_v3"
    node_count         = 3
    min_count          = 3
    max_count          = 5
    availability_zones = ["1", "2", "3"]
    os_disk_size_gb    = 128
    max_pods           = 110
    enable_auto_scaling = true
    node_labels        = {
      "nodepool-type" = "system"
      "environment"   = "production"
    }
    node_taints        = ["CriticalAddonsOnly=true:NoSchedule"]
  }
}

# Application Node Pool Configuration
variable "app_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    node_count         = number
    min_count          = number
    max_count          = number
    availability_zones = list(string)
    os_disk_size_gb    = number
    max_pods           = number
    enable_auto_scaling = bool
    node_labels        = map(string)
    node_taints        = list(string)
  })
  description = "Configuration for the application node pool"
  default = {
    name                = "app"
    vm_size            = "Standard_D8s_v3"
    node_count         = 3
    min_count          = 3
    max_count          = 20
    availability_zones = ["1", "2", "3"]
    os_disk_size_gb    = 256
    max_pods           = 110
    enable_auto_scaling = true
    node_labels        = {
      "nodepool-type" = "app"
      "environment"   = "production"
    }
    node_taints        = []
  }
}

# GPU Node Pool Configuration
variable "gpu_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    node_count         = number
    min_count          = number
    max_count          = number
    availability_zones = list(string)
    os_disk_size_gb    = number
    max_pods           = number
    enable_auto_scaling = bool
    node_labels        = map(string)
    node_taints        = list(string)
  })
  description = "Configuration for the GPU node pool for OCR workloads"
  default = {
    name                = "gpu"
    vm_size            = "Standard_NC6s_v3"
    node_count         = 2
    min_count          = 2
    max_count          = 8
    availability_zones = ["1", "2"]
    os_disk_size_gb    = 256
    max_pods           = 110
    enable_auto_scaling = true
    node_labels        = {
      "nodepool-type" = "gpu"
      "environment"   = "production"
      "gpu"          = "nvidia"
    }
    node_taints        = ["nvidia.com/gpu=present:NoSchedule"]
  }
}

# Network Profile Configuration
variable "network_profile" {
  type = object({
    network_plugin     = string
    network_policy     = string
    dns_service_ip     = string
    docker_bridge_cidr = string
    service_cidr       = string
    load_balancer_sku  = string
    outbound_type      = string
  })
  description = "Network configuration for the AKS cluster"
  default = {
    network_plugin     = "azure"
    network_policy     = "calico"
    dns_service_ip     = "10.0.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
    service_cidr       = "10.0.0.0/16"
    load_balancer_sku  = "standard"
    outbound_type      = "loadBalancer"
  }
}

# Private Cluster Configuration
variable "private_cluster_config" {
  type = object({
    enable_private_cluster = bool
    private_dns_zone_id   = string
    enable_private_endpoint = bool
    subnet_id             = string
  })
  description = "Private cluster configuration settings"
  default = {
    enable_private_cluster = true
    private_dns_zone_id   = null
    enable_private_endpoint = true
    subnet_id             = null
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  type = object({
    enable_log_analytics     = bool
    log_analytics_workspace_id = string
    metrics_retention_in_days = number
    enable_oms_agent         = bool
    enable_container_insights = bool
  })
  description = "Monitoring configuration for the AKS cluster"
  default = {
    enable_log_analytics     = true
    log_analytics_workspace_id = null
    metrics_retention_in_days = 30
    enable_oms_agent         = true
    enable_container_insights = true
  }
}

# Resource Tags
variable "tags" {
  type        = map(string)
  description = "Resource tags for the AKS cluster and associated resources"
  default = {
    Environment = "Production"
    ManagedBy   = "Terraform"
    Project     = "AI-Catalog-Search"
  }
}