# Cluster resource ID output
output "cluster_id" {
  value       = azurerm_kubernetes_cluster.main.id
  description = "The Azure resource ID of the AKS cluster"
}

# Standard kubeconfig output for cluster access
output "kube_config" {
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  description = "Raw kubeconfig file content for standard cluster access"
  sensitive   = true
}

# Admin kubeconfig output for privileged operations
output "kube_admin_config" {
  value       = azurerm_kubernetes_cluster.main.kube_admin_config_raw
  description = "Raw kubeconfig file content with admin credentials for cluster management"
  sensitive   = true
}

# Node resource group output
output "node_resource_group" {
  value       = azurerm_kubernetes_cluster.main.node_resource_group
  description = "The name of the resource group containing AKS cluster nodes"
}

# Cluster FQDN output
output "cluster_fqdn" {
  value       = azurerm_kubernetes_cluster.main.fqdn
  description = "The FQDN of the AKS cluster control plane"
}

# Private cluster FQDN output
output "private_fqdn" {
  value       = azurerm_kubernetes_cluster.main.private_fqdn
  description = "The private FQDN of the AKS cluster when private cluster is enabled"
}

# Cluster managed identity output
output "cluster_identity" {
  value       = azurerm_kubernetes_cluster.main.identity
  description = "The managed identity information for the AKS cluster"
}