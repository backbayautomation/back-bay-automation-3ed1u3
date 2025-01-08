variable "resource_group_name" {
  description = "Name of the resource group where networking resources will be deployed"
  type        = string
  validation {
    condition     = length(var.resource_group_name) > 0 && can(regex("^[a-zA-Z0-9-_]+$", var.resource_group_name))
    error_message = "Resource group name must be non-empty and contain only alphanumeric characters, hyphens, and underscores"
  }
}

variable "location" {
  description = "Azure region where networking resources will be deployed"
  type        = string
  validation {
    condition     = can(regex("^[a-z]+[a-z0-9]+$", var.location))
    error_message = "Location must be a valid Azure region name in lowercase"
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod) for resource naming and tagging"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "vnet_address_space" {
  description = "Address space for the Virtual Network in CIDR notation"
  type        = list(string)
  default     = ["10.0.0.0/16"]
  validation {
    condition     = alltrue([for cidr in var.vnet_address_space : can(cidrhost(cidr, 0))])
    error_message = "All VNET address spaces must be valid CIDR blocks"
  }
}

variable "subnet_config" {
  description = "Configuration map for subnet definitions including address spaces and service endpoints"
  type = map(object({
    address_prefix                                = string
    service_endpoints                            = list(string)
    private_endpoint_network_policies_enabled    = bool
    delegation = optional(object({
      name = string
      service_delegation = object({
        name    = string
        actions = list(string)
      })
    }))
    enforce_private_link_endpoint_network_policies = optional(bool)
  }))
  validation {
    condition     = alltrue([for k, v in var.subnet_config : can(cidrhost(v.address_prefix, 0)) && alltrue([for cidr in var.vnet_address_space : cidrsubnet(cidr, 0, 0) == cidrsubnet(v.address_prefix, 0, 0)])])
    error_message = "All subnet address prefixes must be valid CIDR blocks within the VNET address space"
  }
}

variable "enable_ddos_protection" {
  description = "Enable or disable Azure DDoS Protection Standard"
  type        = bool
  default     = true
}

variable "nsg_rules" {
  description = "Map of network security group rules for each subnet"
  type = map(list(object({
    name                       = string
    priority                   = number
    direction                  = string
    access                     = string
    protocol                   = string
    source_port_range         = string
    destination_port_range    = string
    source_address_prefix     = string
    destination_address_prefix = string
    description               = optional(string)
  })))
  validation {
    condition     = alltrue([for k, v in var.nsg_rules : alltrue([for rule in v : rule.priority >= 100 && rule.priority <= 4096 && contains(["Inbound", "Outbound"], rule.direction) && contains(["Allow", "Deny"], rule.access)])])
    error_message = "NSG rules must have valid priorities (100-4096), directions (Inbound/Outbound), and access types (Allow/Deny)"
  }
}

variable "appgw_config" {
  description = "Application Gateway configuration including SKU, capacity, and WAF settings"
  type = object({
    sku = object({
      name     = string
      tier     = string
      capacity = number
    })
    frontend_port = number
    waf_enabled  = bool
    waf_config   = optional(object({
      firewall_mode            = string
      rule_set_type           = string
      rule_set_version        = string
      file_upload_limit_mb    = number
      request_body_check      = bool
      max_request_body_size_kb = number
      disabled_rule_groups    = optional(list(object({
        rule_group_name = string
        rules          = optional(list(number))
      })))
    }))
    ssl_policy = optional(object({
      policy_type         = string
      policy_name        = optional(string)
      min_protocol_version = string
      cipher_suites      = optional(list(string))
    }))
    private_ip_allocation = optional(object({
      subnet_id         = string
      private_ip_address = optional(string)
    }))
  })
  validation {
    condition     = contains(["Standard_v2", "WAF_v2"], var.appgw_config.sku.tier) && var.appgw_config.sku.capacity >= 1 && var.appgw_config.sku.capacity <= 125 && var.appgw_config.frontend_port >= 1 && var.appgw_config.frontend_port <= 65535
    error_message = "Application Gateway must have valid SKU, capacity (1-125), and frontend port (1-65535)"
  }
}

variable "tags" {
  description = "Resource tags to be applied to all networking resources"
  type        = map(string)
  default     = {}
}