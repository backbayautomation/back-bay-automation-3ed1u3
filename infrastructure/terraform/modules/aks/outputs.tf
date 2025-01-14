# Cluster resource identifier
output "cluster_id" {
  value       = azurerm_kubernetes_cluster.main.id
  description = "The Azure resource ID of the AKS cluster"
}

# Standard kubeconfig for cluster access
output "kube_config" {
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  description = "Raw kubeconfig file content for standard cluster access with RBAC permissions"
  sensitive   = true
}

# Admin kubeconfig for privileged operations
output "kube_admin_config" {
  value       = azurerm_kubernetes_cluster.main.kube_admin_config_raw
  description = "Raw admin kubeconfig file content for privileged cluster operations"
  sensitive   = true
}

# Node resource group name
output "node_resource_group" {
  value       = azurerm_kubernetes_cluster.main.node_resource_group
  description = "The name of the resource group containing the AKS cluster nodes"
}

# Public cluster FQDN
output "cluster_fqdn" {
  value       = azurerm_kubernetes_cluster.main.fqdn
  description = "The FQDN of the AKS cluster control plane"
}

# Private cluster FQDN
output "private_fqdn" {
  value       = azurerm_kubernetes_cluster.main.private_fqdn
  description = "The private FQDN of the AKS cluster control plane when private cluster is enabled"
}

# Cluster managed identity
output "cluster_identity" {
  value       = azurerm_kubernetes_cluster.main.identity
  description = "The managed identity information for the AKS cluster including principal_id and tenant_id"
}