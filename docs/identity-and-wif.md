# Worker identity and Google Cloud Workload Identity Federation

Status: requirements only. No Google Cloud project, Workload Identity Pool, provider, service account binding, or GitHub OIDC trust has been configured or verified.

## Required model

- GitHub-hosted CI receives only the default read-only token and does not request `id-token: write`.
- A cloud-deploying workflow may request an OIDC token only after its exact repository, event, ref, and workflow identity are approved.
- Google Cloud trusts GitHub through Workload Identity Federation (WIF). Do not create or store service-account JSON keys.
- Restrict the provider condition to the exact organization/repository and branch or protected environment. Do not trust all repositories in the organization.
- Bind a dedicated service account with only the roles needed for one deployment target. Do not grant project-wide Editor.
- Verify rejection for a fork PR, an unapproved repository, an unprotected branch, an unexpected audience, and an expired or malformed token.

## Inputs required before applying configuration

The actual Google Cloud project number, pool ID, provider ID, target service account, deployment service, and protected branch/environment must come from the owner and the live cloud account. The GitHub token issuer, audience, and subject mapping must be confirmed against the chosen GitHub OIDC claims before creating a trust binding.

No values are guessed in this contract. No credentials or trust policy are present in this repository.
