# Backend configuration for Terraform state management in Azure
# Version: ~> 1.0
terraform {
  # Azure Storage Account backend configuration with enhanced security
  backend "azurerm" {
    # Resource group for state storage - environment-specific
    resource_group_name = "tfstate-${var.environment}"
    
    # Unique storage account name with environment suffix
    storage_account_name = "tfstate${var.environment}${random_string.unique.result}"
    
    # Dedicated container for state files
    container_name = "tfstate"
    
    # State file path within container
    key = "terraform.tfstate"
    
    # Use Managed Identity for secure authentication
    use_msi = true
    
    # Environment-specific Azure subscription and tenant IDs
    subscription_id = var.subscription_id
    tenant_id = var.tenant_id
    
    # Azure cloud environment specification
    environment = "public"
    
    # Enhanced security settings
    min_tls_version = "TLS1_2"
    enable_https_traffic_only = true
    allow_nested_items_to_be_public = false
    
    # Network security rules
    network_rules {
      default_action = "Deny"
      ip_rules = []
      virtual_network_subnet_ids = []
    }
  }
}

# Random string for unique storage account name
resource "random_string" "unique" {
  length  = 8
  special = false
  upper   = false
}

# Variables for backend configuration
variable "environment" {
  description = "Environment name for backend resources"
  type        = string
}

variable "subscription_id" {
  description = "Azure subscription ID for backend resources"
  type        = string
}

variable "tenant_id" {
  description = "Azure AD tenant ID for backend resources"
  type        = string
}

# Local variables for backend configuration
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Purpose     = "State Storage"
  }
}

# Data source for current Azure subscription
data "azurerm_subscription" "current" {}

# Data source for current Azure client configuration
data "azurerm_client_config" "current" {}