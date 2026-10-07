variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry and Cloud Run"
  type        = string
  default     = "southamerica-east1"
}

variable "github_repo" {
  description = "GitHub repository in owner/repo form (for Workload Identity Federation)"
  type        = string
}
