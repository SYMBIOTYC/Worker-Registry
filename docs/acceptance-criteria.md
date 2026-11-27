# Runtime acceptance criteria

These checks are required before the Registry or a worker pool is described as operational.

## API and security

- The service is reachable over TLS and reports liveness and readiness separately.
- Missing, expired, wrong-issuer, wrong-audience, malformed, and wrong-role tokens are rejected.
- Registration uses a unique idempotency key. A repeated identical request is safe; a conflicting reuse is rejected.
- Registration creates a `pending` worker. A pending worker never appears as schedulable.
- Only an administrator can approve capabilities, set a concurrency ceiling, drain, or revoke a worker.
- A worker cannot raise its approved capabilities or concurrency by editing its registration or heartbeat.
- Registry state transitions produce auditable actor, request ID, timestamp, and reason records.

## Health and scheduling

- A valid heartbeat renews the server-side lease and updates available slots.
- A heartbeat reporting more slots than the approved maximum is rejected.
- A missed lease changes an approved worker to `unhealthy`; a scheduler integration test proves that it receives no new work.
- Draining excludes the worker from new jobs while allowing documented in-flight completion.
- Revocation prevents all future scheduling and token refresh.

## End-to-end execution proof

For a real compute job, retain linked evidence for: approved worker identity; registry lease at dispatch time; scheduler decision and job ID; worker agent version; task start/end timestamps; exit code; immutable artifact digest and retrieval; execution receipt; and CI/audit logs. A GitHub-hosted bootstrap run proves only that the CI workflow ran on GitHub-hosted Ubuntu.

## Current verified state

The CI workflow in this change validates the API contract on GitHub-hosted Ubuntu 24.04 and uploads a contract-check receipt. It does not start an API service or prove cloud identity, persistent worker health, dispatch, or artifact transfer.
