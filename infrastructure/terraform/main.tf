# Main Terraform configuration file for AI-powered Product Catalog Search System
# Version: 1.0
# Provider Versions:
# - azurerm: ~> 3.0
# - random: ~> 3.0
# - tls: ~> 4.0

# Core Terraform configuration with Azure backend
terraform {
  required_version = ">= 1.0"
  
  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "tfstate"
    container_name      = "tfstate"
    key                = "terraform.tfstate"
    use_msi            = true
    subscription_id    = "${var.subscription_id}"
    tenant_id         = "${var.tenant_id}"
  }
}

# Main resource group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags

  lifecycle {
    prevent_destroy = true
  }
}

# Networking module for VNet and subnet configuration
module "networking" {
  source = "./modules/networking"

  resource_group_name    = azurerm_resource_group.main.name
  location              = var.location
  environment           = var.environment
  network_config        = var.network_config
  tags                  = var.tags
  enable_ddos_protection = true
  enable_bastion        = true

  depends_on = [azurerm_resource_group.main]
}

# AKS module for Kubernetes cluster deployment
module "aks" {
  source = "./modules/aks"

  resource_group_name        = azurerm_resource_group.main.name
  location                  = var.location
  environment               = var.environment
  aks_config                = var.aks_config
  subnet_id                 = module.networking.aks_subnet_id
  tags                      = var.tags
  enable_pod_security_policy = true
  enable_azure_policy       = true

  depends_on = [module.networking]
}

# Database module for SQL and Cosmos DB
module "database" {
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.main.name
  location           = var.location
  environment        = var.environment
  database_config    = var.database_config
  subnet_ids         = module.networking.database_subnet_ids
  tags               = var.tags

  depends_on = [module.networking]
}

# Storage module for blob and file storage
module "storage" {
  source = "./modules/storage"

  resource_group_name = azurerm_resource_group.main.name
  location           = var.location
  environment        = var.environment
  storage_config     = var.storage_config
  subnet_ids         = module.networking.storage_subnet_ids
  tags               = var.tags

  depends_on = [module.networking]
}

# Monitoring module for observability and alerts
module "monitoring" {
  source = "./modules/monitoring"

  resource_group_name  = azurerm_resource_group.main.name
  location            = var.location
  environment         = var.environment
  monitoring_config   = var.monitoring_config
  aks_cluster_id      = module.aks.cluster_id
  database_server_ids = module.database.server_ids
  storage_account_ids = module.storage.account_ids
  tags                = var.tags

  depends_on = [
    module.aks,
    module.database,
    module.storage
  ]
}

# Output the resource group details
output "resource_group_name" {
  value = {
    name     = azurerm_resource_group.main.name
    id       = azurerm_resource_group.main.id
    location = azurerm_resource_group.main.location
  }
  description = "Resource group details for dependent resources"
}

# Output AKS cluster details
output "aks_cluster_details" {
  value = {
    id          = module.aks.cluster_id
    kube_config = module.aks.kube_config
    node_pools  = module.aks.node_pools
  }
  description = "Comprehensive AKS cluster information"
  sensitive   = true
}

# Output database connection details
output "database_connection_details" {
  value = {
    sql_connection_string    = module.database.sql_connection_string
    cosmos_connection_string = module.database.cosmos_connection_string
    redis_connection_string  = module.database.redis_connection_string
  }
  description = "Secure database connection information"
  sensitive   = true
}

# Output storage account details
output "storage_details" {
  value = {
    primary_account_id = module.storage.primary_account_id
    containers        = module.storage.containers
    endpoints         = module.storage.endpoints
  }
  description = "Storage account configuration and access details"
  sensitive   = true
}

# Output monitoring workspace details
output "monitoring_details" {
  value = {
    workspace_id = module.monitoring.workspace_id
    workspace_key = module.monitoring.workspace_key
    app_insights_key = module.monitoring.app_insights_key
  }
  description = "Monitoring and observability configuration details"
  sensitive   = true
}