# Required base configuration variables
variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where AKS cluster will be deployed"
}

variable "location" {
  type        = string
  description = "Azure region where AKS cluster will be deployed"
}

variable "cluster_name" {
  type        = string
  description = "Name of the AKS cluster"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the AKS cluster"
  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be in the format: X.Y.Z"
  }
}

# Node pool configurations
variable "system_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    enable_auto_scaling = bool
    node_count         = number
    min_count          = number
    max_count          = number
    os_disk_size_gb    = number
    max_pods           = number
  })
  description = "Configuration for the system node pool running critical system pods"
  default = {
    name                = "system"
    vm_size            = "Standard_D4s_v3"
    enable_auto_scaling = true
    node_count         = 3
    min_count          = 2
    max_count          = 5
    os_disk_size_gb    = 128
    max_pods           = 30
  }
}

variable "app_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    enable_auto_scaling = bool
    node_count         = number
    min_count          = number
    max_count          = number
    os_disk_size_gb    = number
    max_pods           = number
  })
  description = "Configuration for the application node pool running business workloads"
  default = {
    name                = "app"
    vm_size            = "Standard_D8s_v3"
    enable_auto_scaling = true
    node_count         = 3
    min_count          = 3
    max_count          = 20
    os_disk_size_gb    = 256
    max_pods           = 50
  }
}

variable "gpu_node_pool_config" {
  type = object({
    name                = string
    vm_size            = string
    enable_auto_scaling = bool
    node_count         = number
    min_count          = number
    max_count          = number
    os_disk_size_gb    = number
    max_pods           = number
    node_taints        = list(string)
  })
  description = "Configuration for the GPU node pool running OCR and AI workloads"
  default = {
    name                = "gpu"
    vm_size            = "Standard_NC6s_v3"
    enable_auto_scaling = true
    node_count         = 2
    min_count          = 2
    max_count          = 8
    os_disk_size_gb    = 256
    max_pods           = 30
    node_taints        = ["nvidia.com/gpu=present:NoSchedule"]
  }
}

# Network configuration
variable "network_profile" {
  type = object({
    network_plugin     = string
    network_policy    = string
    dns_service_ip    = string
    service_cidr      = string
    docker_bridge_cidr = string
    load_balancer_sku = string
  })
  description = "Network configuration for the AKS cluster"
  default = {
    network_plugin     = "azure"
    network_policy    = "calico"
    dns_service_ip    = "10.0.0.10"
    service_cidr      = "10.0.0.0/16"
    docker_bridge_cidr = "172.17.0.1/16"
    load_balancer_sku = "standard"
  }
}

# Private cluster configuration
variable "private_cluster_config" {
  type = object({
    enable_private_cluster = bool
    private_dns_zone_id   = string
    enable_private_endpoint = bool
    subnet_id             = string
  })
  description = "Private cluster configuration for enhanced security"
  default = {
    enable_private_cluster = true
    private_dns_zone_id   = null
    enable_private_endpoint = true
    subnet_id             = null
  }
}

# Monitoring configuration
variable "monitoring_config" {
  type = object({
    enable_log_analytics     = bool
    log_analytics_workspace_id = string
    metrics_retention_days   = number
    enable_oms_agent        = bool
  })
  description = "Monitoring configuration for Azure Monitor integration"
  default = {
    enable_log_analytics     = true
    log_analytics_workspace_id = null
    metrics_retention_days   = 30
    enable_oms_agent        = true
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for organization and billing purposes"
  default = {
    Environment = "production"
    ManagedBy   = "terraform"
    Project     = "ai-catalog-search"
  }
}