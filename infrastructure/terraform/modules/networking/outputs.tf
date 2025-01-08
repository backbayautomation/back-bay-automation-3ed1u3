# Virtual Network outputs
output "vnet_id" {
  description = "The resource ID of the Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "The name of the Virtual Network"
  value       = azurerm_virtual_network.main.name
}

# Subnet outputs with comprehensive configuration details
output "subnet_ids" {
  description = "Map of subnet configurations including IDs, names, address prefixes and associated NSGs"
  value = {
    for name, subnet in azurerm_subnet.subnets : name => {
      id             = subnet.id
      name           = subnet.name
      address_prefix = subnet.address_prefixes[0]
      security_group_id = try(
        azurerm_network_security_group.nsgs[name].id,
        null
      )
    }
  }
}

# Network Security Group outputs with detailed configuration
output "nsg_ids" {
  description = "Map of NSG configurations including IDs, associated subnets and rule counts"
  value = {
    for name, nsg in azurerm_network_security_group.nsgs : name => {
      id                 = nsg.id
      subnet_associations = [
        for association in azurerm_subnet_network_security_group_association.nsg_associations : association.subnet_id
        if association.network_security_group_id == nsg.id
      ]
      rule_count = length(var.nsg_rules[name])
    }
  }
}

# Application Gateway outputs
output "appgw_id" {
  description = "The resource ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "appgw_frontend_ips" {
  description = "The frontend IP configurations of the Application Gateway"
  value = {
    public_ip  = try(azurerm_application_gateway.main.frontend_ip_configuration[0].public_ip_address_id, null)
    private_ip = try(azurerm_application_gateway.main.frontend_ip_configuration[0].private_ip_address, null)
  }
}