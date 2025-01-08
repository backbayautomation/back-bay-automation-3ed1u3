# Output definitions for database module resources
# Exposes essential information about provisioned Azure SQL Database and Cosmos DB resources

# SQL Server outputs
output "sql_server_id" {
  value       = azurerm_mssql_server.main.id
  description = "Resource ID of the provisioned Azure SQL Server"
}

output "sql_server_fqdn" {
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
  description = "Fully qualified domain name of the Azure SQL Server"
}

# SQL Database outputs
output "sql_database_id" {
  value       = azurerm_mssql_database.main.id
  description = "Resource ID of the provisioned Azure SQL Database"
}

output "sql_database_name" {
  value       = azurerm_mssql_database.main.name
  description = "Name of the provisioned Azure SQL Database"
}

# Cosmos DB outputs
output "cosmos_db_id" {
  value       = azurerm_cosmosdb_account.main.id
  description = "Resource ID of the provisioned Cosmos DB account"
}

output "cosmos_db_endpoint" {
  value       = azurerm_cosmosdb_account.main.endpoint
  description = "Endpoint URL of the Cosmos DB account"
}

output "cosmos_db_connection_strings" {
  value       = azurerm_cosmosdb_account.main.connection_strings
  sensitive   = true
  description = "List of connection strings for the Cosmos DB account. Marked as sensitive to prevent exposure in logs and outputs"
}

output "cosmos_db_primary_key" {
  value       = azurerm_cosmosdb_account.main.primary_key
  sensitive   = true
  description = "Primary key for the Cosmos DB account. Marked as sensitive to prevent exposure in logs and outputs"
}