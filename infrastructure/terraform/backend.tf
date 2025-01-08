# Backend configuration for Terraform state management in Azure
# Implements secure state storage with encryption, access controls, and state locking
# Version: ~> 1.0

# Generate a unique suffix for the storage account name
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
}

# Configure the Azure backend for Terraform state
terraform {
  backend "azurerm" {
    # Resource group for state storage - environment-specific
    resource_group_name = "tfstate-${var.environment}"
    
    # Unique storage account name with environment suffix
    storage_account_name = "tfstate${var.environment}${random_string.unique.result}"
    
    # Container configuration
    container_name = "tfstate"
    key            = "terraform.tfstate"
    
    # Security configuration
    use_msi                              = true
    subscription_id                      = var.subscription_id
    tenant_id                           = var.tenant_id
    environment                         = "public"
    min_tls_version                     = "TLS1_2"
    enable_https_traffic_only           = true
    allow_nested_items_to_be_public     = false
    
    # Network security rules
    network_rules {
      default_action             = "Deny"
      ip_rules                  = []
      virtual_network_subnet_ids = []
    }
  }
}

# Variables for backend configuration
variable "environment" {
  description = "Environment name for state storage resources"
  type        = string
}

variable "subscription_id" {
  description = "Azure subscription ID for state storage"
  type        = string
}

variable "tenant_id" {
  description = "Azure AD tenant ID for authentication"
  type        = string
}

# Local variables for backend configuration
locals {
  # Common tags for state storage resources
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Purpose     = "State Storage"
  }
  
  # Storage account configuration
  storage_config = {
    account_tier             = "Standard"
    account_replication_type = "ZRS"
    min_tls_version         = "TLS1_2"
  }
}

# Output the backend storage account name
output "backend_storage_account_name" {
  description = "Name of the storage account used for Terraform state"
  value       = "tfstate${var.environment}${random_string.unique.result}"
  sensitive   = true
}