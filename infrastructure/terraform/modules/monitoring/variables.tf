variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod) for deploying monitoring resources"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "location" {
  type        = string
  description = "Azure region where monitoring resources will be deployed, must align with compliance requirements"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group where monitoring resources will be deployed, following naming conventions"
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all monitoring resources for better resource management and cost allocation"
  default     = {}
}

variable "log_retention_days" {
  type        = number
  description = "Number of days to retain logs in Log Analytics workspace, must comply with regulatory requirements"
  default     = 30
  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention days must be between 30 and 730 to balance cost and compliance requirements"
  }
}

variable "app_insights_sampling_percentage" {
  type        = number
  description = "Sampling percentage for Application Insights data collection to optimize cost and performance"
  default     = 100
  validation {
    condition     = var.app_insights_sampling_percentage > 0 && var.app_insights_sampling_percentage <= 100
    error_message = "Sampling percentage must be between 1 and 100"
  }
}

variable "alert_notification_email" {
  type        = string
  description = "Email address for receiving monitoring alerts, must be a valid corporate email"
  validation {
    condition     = can(regex("^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$", var.alert_notification_email))
    error_message = "Must provide a valid email address"
  }
}

variable "alert_thresholds" {
  type = object({
    cpu_percentage       = number
    memory_percentage   = number
    response_time_ms    = number
    error_rate_percentage = number
  })
  description = "Threshold values for different monitoring alerts based on industry standards and application requirements"
  default = {
    cpu_percentage       = 80
    memory_percentage   = 85
    response_time_ms    = 1000
    error_rate_percentage = 5
  }
  validation {
    condition = alltrue([
      var.alert_thresholds.cpu_percentage > 0 && var.alert_thresholds.cpu_percentage <= 100,
      var.alert_thresholds.memory_percentage > 0 && var.alert_thresholds.memory_percentage <= 100,
      var.alert_thresholds.response_time_ms > 0,
      var.alert_thresholds.error_rate_percentage >= 0 && var.alert_thresholds.error_rate_percentage <= 100
    ])
    error_message = "Alert thresholds must be within valid ranges: CPU and Memory (1-100), Response Time (>0), Error Rate (0-100)"
  }
}