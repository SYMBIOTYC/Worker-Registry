# Worker lifecycle and heartbeats

This is the proposed contract for the Worker Registry. No registry service is deployed yet.

## Registration and approval

1. An authenticated worker requests registration with its class, pool, operating system, architecture, agent version, requested capabilities, and requested concurrency.
2. The API derives the principal from the validated short-lived identity token. It does not accept an asserted provider identity or trust claims in the body.
3. The server creates a `pending` record. Pending workers are never schedulable.
4. An administrator reviews the identity and requested capabilities, then approves an explicit capability allowlist and concurrency ceiling.
5. A worker is schedulable only while approved, not draining or revoked, and its server-side heartbeat lease is valid.

The worker's self-reported capabilities are stored separately from approved capabilities. The scheduler must use only the approved set.

## Heartbeat lease

Workers periodically send `agent_version` and `available_slots`. The API records server receipt time and returns the server-calculated lease expiry and heartbeat interval. Client timestamps are not authoritative.

The initial contract leaves lease duration and stale threshold as deployment configuration. Before production, set both explicitly and test the boundary. A missed lease transitions an approved worker to `unhealthy`; the scheduler immediately excludes it. A heartbeat does not un-revoke a worker or bypass approval.

## Lifecycle

- `pending`: identity registered; awaiting approval; never schedulable.
- `online`: approved and lease-valid; eligible only for approved capabilities and remaining capacity.
- `draining`: no new jobs; existing jobs may finish.
- `unhealthy`: approved worker missed its health lease; no new jobs.
- `revoked`: identity disabled; no scheduling, even if heartbeats continue.

All approval, capability changes, drain, and revocation actions must emit an audit event with actor, request ID, timestamp, target worker, and reason. Registry state is not a substitute for job execution receipts.
