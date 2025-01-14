# Output variables for Azure SQL Server resources
output "sql_server_id" {
  value       = azurerm_mssql_server.main.id
  description = "Resource ID of the provisioned Azure SQL Server for resource referencing"
}

output "sql_server_fqdn" {
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
  description = "Fully qualified domain name of the Azure SQL Server for connection purposes"
}

output "sql_database_id" {
  value       = azurerm_mssql_database.main.id
  description = "Resource ID of the provisioned Azure SQL Database for resource referencing"
}

output "sql_database_name" {
  value       = azurerm_mssql_database.main.name
  description = "Name of the provisioned SQL Database for connection strings and resource identification"
}

# Output variables for Cosmos DB resources
output "cosmos_db_id" {
  value       = azurerm_cosmosdb_account.main.id
  description = "Resource ID of the provisioned Cosmos DB account for resource referencing"
}

output "cosmos_db_endpoint" {
  value       = azurerm_cosmosdb_account.main.endpoint
  description = "Endpoint URL of the Cosmos DB account for connection purposes"
}

output "cosmos_db_connection_strings" {
  value       = azurerm_cosmosdb_account.main.connection_strings
  sensitive   = true
  description = "Connection strings for the Cosmos DB account. Marked as sensitive to prevent exposure in logs and outputs"
}

output "cosmos_db_primary_key" {
  value       = azurerm_cosmosdb_account.main.primary_key
  sensitive   = true
  description = "Primary key of the Cosmos DB account for authentication. Marked as sensitive to prevent exposure in logs and outputs"
}