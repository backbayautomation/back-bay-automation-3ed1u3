# Storage Account outputs
output "storage_account_name" {
  description = "The name of the Azure Storage Account"
  value       = azurerm_storage_account.storage_account.name
}

output "storage_account_key" {
  description = "The primary access key for the storage account"
  value       = azurerm_storage_account.storage_account.primary_access_key
  sensitive   = true
}

output "blob_endpoint" {
  description = "The endpoint URL for blob storage access"
  value       = azurerm_storage_account.storage_account.primary_blob_endpoint
}

# Cosmos DB outputs
output "cosmos_db_name" {
  description = "The name of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.name
}

output "cosmos_db_key" {
  description = "The primary key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.primary_key
  sensitive   = true
}

output "cosmos_db_connection_string" {
  description = "The primary connection string for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.cosmos_db_account.connection_strings[0]
  sensitive   = true
}

# Redis Cache outputs
output "redis_cache_name" {
  description = "The name of the Redis Cache instance"
  value       = azurerm_redis_cache.redis_cache.name
}

output "redis_connection_string" {
  description = "The primary connection string for the Redis Cache"
  value       = azurerm_redis_cache.redis_cache.primary_connection_string
  sensitive   = true
}

output "redis_hostname" {
  description = "The hostname of the Redis Cache instance"
  value       = azurerm_redis_cache.redis_cache.hostname
}