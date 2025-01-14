# Configure Azure provider requirements
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  # Resource naming convention
  name_prefix = "az-${var.environment}"
  vnet_name   = "${local.name_prefix}-vnet"
  ddos_name   = "${local.name_prefix}-ddos"
  appgw_name  = "${local.name_prefix}-appgw"

  # Common tags for all resources
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "networking"
  })

  # Computed subnet configurations
  subnet_configs = {
    for name, config in var.subnet_config : name => {
      name                                          = "${local.name_prefix}-subnet-${name}"
      address_prefix                                = config.address_prefix
      service_endpoints                             = config.service_endpoints
      private_endpoint_network_policies_enabled     = config.private_endpoint_network_policies_enabled
      delegation                                    = config.delegation
    }
  }
}

# DDoS Protection Plan
resource "azurerm_network_ddos_protection_plan" "main" {
  count               = var.enable_ddos_protection ? 1 : 0
  name                = local.ddos_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = local.vnet_name
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space
  
  dynamic "ddos_protection_plan" {
    for_each = var.enable_ddos_protection ? [1] : []
    content {
      id     = azurerm_network_ddos_protection_plan.main[0].id
      enable = true
    }
  }

  tags = local.common_tags
}

# Subnets
resource "azurerm_subnet" "main" {
  for_each = local.subnet_configs

  name                                          = each.value.name
  resource_group_name                           = var.resource_group_name
  virtual_network_name                          = azurerm_virtual_network.main.name
  address_prefixes                              = [each.value.address_prefix]
  service_endpoints                             = each.value.service_endpoints
  private_endpoint_network_policies_enabled     = each.value.private_endpoint_network_policies_enabled

  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = delegation.value.name
      service_delegation {
        name    = delegation.value.service_delegation.name
        actions = delegation.value.service_delegation.actions
      }
    }
  }
}

# Network Security Groups
resource "azurerm_network_security_group" "main" {
  for_each = var.nsg_rules

  name                = "${local.name_prefix}-nsg-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.common_tags

  dynamic "security_rule" {
    for_each = each.value
    content {
      name                       = security_rule.value.name
      priority                   = security_rule.value.priority
      direction                  = security_rule.value.direction
      access                     = security_rule.value.access
      protocol                   = security_rule.value.protocol
      source_port_range          = security_rule.value.source_port_range
      destination_port_range     = security_rule.value.destination_port_range
      source_address_prefix      = security_rule.value.source_address_prefix
      destination_address_prefix = security_rule.value.destination_address_prefix
      description               = security_rule.value.description
    }
  }
}

# NSG Associations
resource "azurerm_subnet_network_security_group_association" "main" {
  for_each = var.nsg_rules

  subnet_id                 = azurerm_subnet.main[each.key].id
  network_security_group_id = azurerm_network_security_group.main[each.key].id
}

# Application Gateway
resource "azurerm_application_gateway" "main" {
  name                = local.appgw_name
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = local.common_tags

  sku {
    name     = var.appgw_config.sku.name
    tier     = var.appgw_config.sku.tier
    capacity = var.appgw_config.sku.capacity
  }

  gateway_ip_configuration {
    name      = "${local.appgw_name}-ip-config"
    subnet_id = azurerm_subnet.main["appgw"].id
  }

  frontend_port {
    name = "${local.appgw_name}-feport"
    port = var.appgw_config.frontend_port
  }

  frontend_ip_configuration {
    name                          = "${local.appgw_name}-feip"
    subnet_id                     = azurerm_subnet.main["appgw"].id
    private_ip_address_allocation = var.appgw_config.private_ip_allocation != null ? "Static" : "Dynamic"
    private_ip_address           = var.appgw_config.private_ip_allocation != null ? var.appgw_config.private_ip_allocation.private_ip_address : null
  }

  backend_address_pool {
    name = "${local.appgw_name}-beap"
  }

  backend_http_settings {
    name                  = "${local.appgw_name}-be-htst"
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol             = "Http"
    request_timeout      = 60
  }

  http_listener {
    name                           = "${local.appgw_name}-httplstn"
    frontend_ip_configuration_name = "${local.appgw_name}-feip"
    frontend_port_name            = "${local.appgw_name}-feport"
    protocol                      = "Http"
  }

  request_routing_rule {
    name                       = "${local.appgw_name}-rqrt"
    rule_type                 = "Basic"
    http_listener_name        = "${local.appgw_name}-httplstn"
    backend_address_pool_name = "${local.appgw_name}-beap"
    backend_http_settings_name = "${local.appgw_name}-be-htst"
    priority                  = 100
  }

  dynamic "ssl_policy" {
    for_each = var.appgw_config.ssl_policy != null ? [var.appgw_config.ssl_policy] : []
    content {
      policy_type          = ssl_policy.value.policy_type
      policy_name         = ssl_policy.value.policy_name
      min_protocol_version = ssl_policy.value.min_protocol_version
      cipher_suites       = ssl_policy.value.cipher_suites
    }
  }

  dynamic "waf_configuration" {
    for_each = var.appgw_config.waf_enabled && var.appgw_config.waf_config != null ? [var.appgw_config.waf_config] : []
    content {
      enabled                  = true
      firewall_mode           = waf_configuration.value.firewall_mode
      rule_set_type           = waf_configuration.value.rule_set_type
      rule_set_version        = waf_configuration.value.rule_set_version
      file_upload_limit_mb    = waf_configuration.value.file_upload_limit_mb
      request_body_check      = waf_configuration.value.request_body_check
      max_request_body_size_kb = waf_configuration.value.max_request_body_size_kb

      dynamic "disabled_rule_group" {
        for_each = waf_configuration.value.disabled_rule_groups != null ? waf_configuration.value.disabled_rule_groups : []
        content {
          rule_group_name = disabled_rule_group.value.rule_group_name
          rules           = disabled_rule_group.value.rules
        }
      }
    }
  }
}

# Output values
output "vnet_id" {
  description = "The ID of the Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "subnet_ids" {
  description = "Map of subnet names to subnet IDs"
  value       = {
    for name, subnet in azurerm_subnet.main : name => subnet.id
  }
}

output "appgw_id" {
  description = "The ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "nsg_ids" {
  description = "Map of NSG names to NSG IDs"
  value       = {
    for name, nsg in azurerm_network_security_group.main : name => nsg.id
  }
}