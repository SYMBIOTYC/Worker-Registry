# Registry boundaries

The Worker Registry owns worker enrollment, approved capabilities, capacity, heartbeat leases, lifecycle state, and audit events.

The following services remain separate:

- **Scheduler and Job API:** create and dispatch job intents; choose a worker using approved registry state and idempotency controls.
- **Execution workers:** claim only authorized jobs and report an authenticated execution receipt.
- **Artifact store:** transfers job inputs and outputs with checksum and retention policy.
- **Cloud identity:** verifies short-lived worker identities and optional Google Cloud WIF for CI-to-cloud deployment.
- **RemoteView:** independent operator access to explicitly paired hosts.

This split prevents the Registry from becoming a job queue, artifact proxy, credential store, or remote-desktop controller. A shared contract does not mean the other components are deployed.
