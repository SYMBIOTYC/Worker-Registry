# Symbiotyc Worker Registry

Worker Registry is the control-plane record of compute workers. It tracks identity, approved capabilities, health leases, capacity, and lifecycle state. The scheduler must treat registry data as authoritative and must never dispatch work to an unapproved or stale worker.

## Worker classes

- **Linux CI** — short-lived GitHub-hosted Ubuntu jobs. These are not persistent workers and are not registered here.
- **CPU** — persistent or on-demand compute workers for approved compute jobs.
- **VPS** — persistent edge services with explicit capabilities and health checks.

Worker class, capabilities, concurrency, and trust are separate fields. A worker cannot select its own trust level.

## Contract and status

The initial registry API contract and acceptance criteria are being added on a review branch. This repository does not yet contain a deployed registry service, database, scheduler, cloud identity provider, or persistent worker.

Production registration must use authenticated, short-lived identities. New workers start pending and remain ineligible for scheduling until explicitly approved. Heartbeats create server-side leases; missed leases make a worker unhealthy and ineligible.

## Security boundaries

- Never store Google service-account JSON keys, GitHub personal access tokens, or long-lived worker secrets in this repository.
- Validate token issuer and audience against an explicit allowlist.
- Keep Linux CI, CPU, and VPS worker pools isolated.
- Keep job payloads and artifact contents out of registry records; store only bounded metadata and artifact references.
- Record approval, drain, revocation, and dispatch decisions in an auditable event stream.

See the review branch for the API contract, Ubuntu worker baseline, OIDC/WIF requirements, artifact handoff rules, and runtime acceptance gates.
