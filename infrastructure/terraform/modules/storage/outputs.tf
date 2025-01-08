# Storage Account outputs
output "storage_account_name" {
  description = "The name of the Azure Storage Account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_key" {
  description = "The primary access key for the storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "blob_endpoint" {
  description = "The endpoint URL for blob storage access"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

# Cosmos DB outputs
output "cosmos_db_name" {
  description = "The name of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.main.name
}

output "cosmos_db_key" {
  description = "The primary key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.main.primary_key
  sensitive   = true
}

output "cosmos_db_connection_string" {
  description = "The primary connection string for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.main.connection_strings[0]
  sensitive   = true
}

# Redis Cache outputs
output "redis_cache_name" {
  description = "The name of the Redis Cache instance"
  value       = azurerm_redis_cache.main.name
}

output "redis_connection_string" {
  description = "The primary connection string for the Redis Cache"
  value       = azurerm_redis_cache.main.primary_connection_string
  sensitive   = true
}

output "redis_hostname" {
  description = "The hostname of the Redis Cache instance"
  value       = azurerm_redis_cache.main.hostname
}