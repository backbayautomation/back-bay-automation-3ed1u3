# Core Terraform configuration block
# Version: ~> 1.0
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    # Azure Resource Manager provider - Version: ~> 3.0
    # Used for managing Azure cloud infrastructure resources
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    
    # Random provider - Version: ~> 3.0
    # Used for generating unique resource identifiers
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    
    # TLS provider - Version: ~> 4.0
    # Used for certificate management and secure communications
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Azure Resource Manager provider configuration with enhanced security features
provider "azurerm" {
  features {
    # Key Vault security configurations
    key_vault {
      purge_soft_delete_on_destroy                = true
      recover_soft_deleted_key_vaults             = true
      purge_soft_deleted_secrets_on_destroy       = true
      purge_soft_deleted_certificates_on_destroy  = true
    }

    # Virtual Machine management settings
    virtual_machine {
      delete_os_disk_on_deletion        = true
      graceful_shutdown                 = true
      skip_shutdown_and_force_delete    = false
    }

    # Resource Group management configurations
    resource_group {
      prevent_deletion_if_contains_resources = false
      cleanup_on_destroy                    = true
    }

    # API Management security settings
    api_management {
      purge_soft_delete_on_destroy = true
      recover_soft_deleted         = true
    }

    # Cognitive Services account management
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }

    # Container Registry cleanup settings
    container_registry {
      purge_soft_deleted_repositories_on_destroy = true
    }
  }
}

# Random provider configuration for generating unique identifiers
provider "random" {
  # Default configuration is sufficient for basic random value generation
}

# TLS provider configuration for certificate management
provider "tls" {
  # Default configuration is sufficient for TLS operations
}