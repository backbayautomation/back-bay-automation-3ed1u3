# Log Analytics Workspace outputs
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace used for centralized logging, metrics collection, and security monitoring"
  value       = azurerm_log_analytics_workspace.main.id
  sensitive   = false
}

output "log_analytics_workspace_workspace_id" {
  description = "Workspace ID of the Log Analytics workspace required for configuring monitoring agents and data collection rules"
  value       = azurerm_log_analytics_workspace.main.workspace_id
  sensitive   = false
}

# Application Insights outputs
output "application_insights_id" {
  description = "ID of the Application Insights instance used for application performance monitoring and distributed tracing"
  value       = azurerm_application_insights.main.id
  sensitive   = false
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights integration - required for application configuration and monitoring agent setup"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights integration - used for secure communication between applications and monitoring backend"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

# Monitor Action Group outputs
output "monitor_action_group_id" {
  description = "ID of the Azure Monitor action group used for configuring alert notifications and automated responses"
  value       = azurerm_monitor_action_group.main.id
  sensitive   = false
}