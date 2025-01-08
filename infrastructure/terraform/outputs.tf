# terraform ~> 1.0
# azurerm ~> 3.0

# Resource Group Outputs
output "resource_group_name" {
  description = "Name of the Azure resource group containing all deployed resources"
  value       = azurerm_resource_group.main.name
}

# Monitoring Outputs
output "monitoring_workspace_id" {
  description = "Resource ID of the Log Analytics workspace for monitoring"
  value       = module.monitoring.workspace_id
}

# AKS Cluster Outputs
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = module.aks.cluster_name
}

output "aks_cluster_endpoint" {
  description = "API server endpoint of the AKS cluster"
  value       = module.aks.cluster_endpoint
}

output "aks_kube_config" {
  description = "Kubeconfig for AKS cluster access"
  value       = module.aks.kube_config
  sensitive   = true
}

# Network Outputs
output "vnet_name" {
  description = "Name of the virtual network"
  value       = module.network.vnet_name
}

output "subnet_ids" {
  description = "Map of subnet names to their IDs"
  value       = module.network.subnet_ids
}

# Storage Outputs
output "storage_account_name" {
  description = "Name of the storage account for document storage"
  value       = module.storage.account_name
}

output "storage_account_key" {
  description = "Primary access key for the storage account"
  value       = module.storage.primary_access_key
  sensitive   = true
}

# Database Outputs
output "sql_server_name" {
  description = "Name of the Azure SQL Server"
  value       = module.database.server_name
}

output "sql_connection_string" {
  description = "Connection string for the Azure SQL Database"
  value       = module.database.connection_string
  sensitive   = true
}

# Security Outputs
output "key_vault_uri" {
  description = "URI of the Azure Key Vault"
  value       = module.security.key_vault_uri
}