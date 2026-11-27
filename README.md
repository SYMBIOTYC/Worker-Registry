# Symbiotyc Worker Registry

Worker Registry is the control-plane record of compute workers. It tracks authenticated identity, server-approved capabilities, health leases, capacity, and lifecycle state. A scheduler must never dispatch work to an unapproved, revoked, draining, or stale worker.

## Worker classes

- **Linux CI** — short-lived GitHub-hosted Ubuntu jobs. These are not persistent workers and are not registered here.
- **CPU** — persistent or on-demand compute workers for approved compute jobs.
- **VPS** — persistent edge services with explicit capabilities and health checks.

Worker class, capabilities, concurrency, and trust are separate fields. A worker cannot select its own trust level.

## Repository status

This repository defines the API contract and runtime acceptance criteria. The `feat/worker-registry-lifecycle-core` branch adds a dependency-free, in-memory lifecycle domain core with seven Node.js unit tests. It is not a deployed registry service and does not yet provide HTTP handlers, persistence, a database, scheduler integration, cloud identity provider, or persistent worker. The branch's two GitHub Actions checks validate the contract and execute the lifecycle unit tests.

Production registration must use authenticated, short-lived identities. New workers start pending and remain ineligible for scheduling until explicitly approved. Heartbeats create server-side leases; missed leases make a worker unhealthy and ineligible.

## Security boundaries

- Never store Google service-account JSON keys, GitHub personal access tokens, or long-lived worker secrets in this repository.
- Validate token issuer and audience against an explicit allowlist.
- Keep Linux CI, CPU, and VPS worker pools isolated.
- Keep job payloads and artifact contents out of registry records; store only bounded metadata and artifact references.
- Record approval, drain, revocation, and dispatch decisions in an auditable event stream.
- Treat the current GitHub-hosted contract check as a contract check only; it does not prove a production worker or cloud integration.

## Contract and operations

- [OpenAPI contract](contracts/worker-registry.openapi.json)
- [Architecture boundaries](docs/architecture.md)
- [Lifecycle, approval, and heartbeat leases](docs/worker-lifecycle.md)
- [Identity and Google Cloud WIF requirements](docs/identity-and-wif.md)
- [Ubuntu 24.04 and Debian 12 worker baseline](docs/ubuntu-worker-baseline.md)
- [Artifact transfer and receipts](docs/artifact-transfer.md)
- [Runtime acceptance criteria](docs/acceptance-criteria.md)
