# Azure Resource Manager provider configuration
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Log Analytics Workspace for centralized logging
resource "azurerm_log_analytics_workspace" "main" {
  name                       = "${var.environment}-ai-catalog-logs"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  sku                       = "PerGB2018"
  retention_in_days         = var.log_retention_days
  daily_quota_gb            = var.log_daily_quota_gb
  internet_ingestion_enabled = true
  internet_query_enabled     = true
  tags                      = merge(var.tags, { "component" = "monitoring" })
}

# Application Insights for application monitoring
resource "azurerm_application_insights" "main" {
  name                       = "${var.environment}-ai-catalog-insights"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  workspace_id              = azurerm_log_analytics_workspace.main.id
  application_type          = "web"
  sampling_percentage       = var.app_insights_sampling_percentage
  disable_ip_masking        = false
  local_authentication_disabled = true
  tags                      = merge(var.tags, { "component" = "monitoring" })
}

# Action group for alert notifications
resource "azurerm_monitor_action_group" "main" {
  name                = "${var.environment}-ai-catalog-alerts"
  resource_group_name = var.resource_group_name
  short_name         = "aicatalert"
  enabled            = true

  email_receiver {
    name                    = "admin"
    email_address          = var.alert_notification_email
    use_common_alert_schema = true
  }

  sms_receiver {
    name         = "oncall"
    country_code = "1"
    phone_number = var.alert_notification_phone
  }

  webhook_receiver {
    name                    = "teams"
    service_uri            = var.teams_webhook_url
    use_common_alert_schema = true
  }
}

# CPU usage alert
resource "azurerm_monitor_metric_alert" "cpu_alert" {
  name                = "${var.environment}-cpu-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "cpu_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.cpu_percentage
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# Memory usage alert
resource "azurerm_monitor_metric_alert" "memory_alert" {
  name                = "${var.environment}-memory-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "memory_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.memory_percentage
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# Response time alert
resource "azurerm_monitor_metric_alert" "response_time_alert" {
  name                = "${var.environment}-response-time-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/duration"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.alert_thresholds.response_time_ms
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }
}

# Diagnostic settings for comprehensive logging
resource "azurerm_monitor_diagnostic_setting" "main" {
  name                       = "${var.environment}-ai-catalog-diagnostics"
  target_resource_id        = azurerm_application_insights.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  log {
    category = "AppAvailabilityResults"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }

  log {
    category = "AppPerformanceCounters"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }

  log {
    category = "AppTraces"
    enabled  = true
    retention_policy {
      enabled = true
      days    = var.log_retention_days
    }
  }
}

# Output values for other modules to consume
output "log_analytics_workspace_id" {
  value       = azurerm_log_analytics_workspace.main.id
  description = "ID of the Log Analytics workspace"
}

output "log_analytics_workspace_workspace_id" {
  value       = azurerm_log_analytics_workspace.main.workspace_id
  description = "Workspace ID of the Log Analytics workspace"
}

output "application_insights_id" {
  value       = azurerm_application_insights.main.id
  description = "ID of the Application Insights instance"
}

output "application_insights_instrumentation_key" {
  value       = azurerm_application_insights.main.instrumentation_key
  description = "Instrumentation key for Application Insights"
  sensitive   = true
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.main.connection_string
  description = "Connection string for Application Insights"
  sensitive   = true
}

output "monitor_action_group_id" {
  value       = azurerm_monitor_action_group.main.id
  description = "ID of the monitor action group"
}