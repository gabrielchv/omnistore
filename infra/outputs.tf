output "service_account_email" {
  description = "Deployer service account email"
  value       = google_service_account.deployer.email
}

output "workload_identity_provider" {
  description = "Full Workload Identity Federation provider resource name"
  value       = "projects/${data.google_project.project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id}"
}

output "artifact_registry_host" {
  description = "Artifact Registry docker host"
  value       = "${google_artifact_registry_repository.repo.location}-docker.pkg.dev"
}

output "artifact_registry_base" {
  description = "Artifact Registry image base, without tag"
  value       = "${google_artifact_registry_repository.repo.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}
