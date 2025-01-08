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
  appgw_name  = "${local.name_prefix}-appgw"
  ddos_name   = "${local.name_prefix}-ddos"

  # Default tags merged with provided tags
  default_tags = {
    Environment     = var.environment
    ManagedBy      = "terraform"
    SecurityLevel   = "high"
    CostCenter     = "networking"
    LastDeployment = timestamp()
  }
  tags = merge(local.default_tags, var.tags)

  # Computed subnet configurations
  subnet_config_with_nsg = {
    for name, config in var.subnet_config : name => merge(config, {
      nsg_name = "${local.name_prefix}-${name}-nsg"
    })
  }
}

# DDoS Protection Plan
resource "azurerm_network_ddos_protection_plan" "main" {
  count               = var.enable_ddos_protection ? 1 : 0
  name                = local.ddos_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
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

  tags = local.tags
}

# Subnets
resource "azurerm_subnet" "subnets" {
  for_each = var.subnet_config

  name                 = "${local.name_prefix}-${each.key}-subnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [each.value.address_prefix]
  service_endpoints    = each.value.service_endpoints

  private_endpoint_network_policies_enabled = each.value.private_endpoint_network_policies_enabled

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
resource "azurerm_network_security_group" "nsgs" {
  for_each = var.nsg_rules

  name                = "${local.name_prefix}-${each.key}-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.tags

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

# NSG Subnet Associations
resource "azurerm_subnet_network_security_group_association" "nsg_associations" {
  for_each = var.nsg_rules

  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.nsgs[each.key].id
}

# Application Gateway
resource "azurerm_application_gateway" "main" {
  name                = local.appgw_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.tags

  sku {
    name     = var.appgw_config.sku.name
    tier     = var.appgw_config.sku.tier
    capacity = var.appgw_config.sku.capacity
  }

  gateway_ip_configuration {
    name      = "gateway-ip-config"
    subnet_id = azurerm_subnet.subnets["appgw"].id
  }

  frontend_port {
    name = "frontend-port"
    port = var.appgw_config.frontend_port
  }

  frontend_ip_configuration {
    name                          = "frontend-ip-config"
    subnet_id                     = azurerm_subnet.subnets["appgw"].id
    private_ip_address_allocation = var.appgw_config.private_ip_allocation != null ? "Static" : "Dynamic"
    private_ip_address           = var.appgw_config.private_ip_allocation != null ? var.appgw_config.private_ip_allocation.private_ip_address : null
  }

  backend_address_pool {
    name = "default-backend-pool"
  }

  backend_http_settings {
    name                  = "default-http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol             = "Http"
    request_timeout      = 30
  }

  http_listener {
    name                           = "default-listener"
    frontend_ip_configuration_name = "frontend-ip-config"
    frontend_port_name            = "frontend-port"
    protocol                      = "Http"
  }

  request_routing_rule {
    name                       = "default-routing-rule"
    rule_type                 = "Basic"
    http_listener_name        = "default-listener"
    backend_address_pool_name = "default-backend-pool"
    backend_http_settings_name = "default-http-settings"
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
  description = "Map of subnet names to their IDs"
  value       = {
    for name, subnet in azurerm_subnet.subnets : name => subnet.id
  }
}

output "appgw_id" {
  description = "The ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "nsg_ids" {
  description = "Map of NSG names to their IDs"
  value       = {
    for name, nsg in azurerm_network_security_group.nsgs : name => nsg.id
  }
}