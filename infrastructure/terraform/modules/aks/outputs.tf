# Output the AKS cluster resource ID
output "cluster_id" {
  value       = azurerm_kubernetes_cluster.main.id
  description = "The Azure resource ID of the AKS cluster"
}

# Output the standard kubeconfig for cluster access
output "kube_config" {
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  description = "The kubeconfig file content for standard cluster access"
  sensitive   = true
}

# Output the admin kubeconfig for privileged access
output "kube_admin_config" {
  value       = azurerm_kubernetes_cluster.main.kube_admin_config_raw
  description = "The kubeconfig file content for admin/privileged cluster access"
  sensitive   = true
}

# Output the managed node resource group name
output "node_resource_group" {
  value       = azurerm_kubernetes_cluster.main.node_resource_group
  description = "The name of the resource group containing the AKS cluster nodes"
}

# Output the cluster's public FQDN
output "cluster_fqdn" {
  value       = azurerm_kubernetes_cluster.main.fqdn
  description = "The FQDN of the AKS cluster's API server endpoint"
}

# Output the cluster's private FQDN
output "private_fqdn" {
  value       = azurerm_kubernetes_cluster.main.private_fqdn
  description = "The private FQDN of the AKS cluster's API server endpoint"
}

# Output the cluster's managed identity information
output "cluster_identity" {
  value       = azurerm_kubernetes_cluster.main.identity
  description = "The managed identity assigned to the AKS cluster"
}