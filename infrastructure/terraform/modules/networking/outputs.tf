# Output definitions for networking module resources
# Exposes critical networking infrastructure components for consumption by other modules

output "vnet_id" {
  description = "The resource ID of the Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "The name of the Virtual Network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Comprehensive map of subnet configurations including IDs, names, address prefixes and associated NSGs"
  value = {
    for name, subnet in azurerm_subnet.main : name => {
      id             = subnet.id
      name           = subnet.name
      address_prefix = subnet.address_prefixes[0]
      security_group_id = try(
        azurerm_network_security_group.main[name].id,
        null
      )
    }
  }
}

output "nsg_ids" {
  description = "Detailed map of NSG configurations including IDs, associated subnets and rule counts"
  value = {
    for name, nsg in azurerm_network_security_group.main : name => {
      id                 = nsg.id
      subnet_associations = [
        for assoc in azurerm_subnet_network_security_group_association.main : assoc.subnet_id
        if assoc.network_security_group_id == nsg.id
      ]
      rule_count = length(var.nsg_rules[name])
    }
  }
}

output "appgw_id" {
  description = "The resource ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "appgw_frontend_ips" {
  description = "The public and private frontend IP addresses of the Application Gateway"
  value = {
    public_ip  = try(
      [for ip in azurerm_application_gateway.main.frontend_ip_configuration : ip.public_ip_address_id if ip.public_ip_address_id != null][0],
      null
    )
    private_ip = try(
      [for ip in azurerm_application_gateway.main.frontend_ip_configuration : ip.private_ip_address if ip.private_ip_address != null][0],
      null
    )
  }
}