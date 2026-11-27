# Persistent Ubuntu and Debian worker baseline

Status: standards only. No VM or host has been provisioned or registered.

## Supported baseline

- Ubuntu Server 24.04 LTS or Debian 12, x86_64 or arm64.
- Fully patched OS and pinned, signed worker-agent release.
- Dedicated unprivileged service account; no interactive user session required.
- systemd service with restart policy, bounded file descriptors, resource limits, and logs sent to the approved collector.
- SSH keys only, restricted management network, and no direct public administration port.
- Inbound network access denied by default. Allow only documented management flows. Egress is limited to the registry, artifact store, OS/package mirrors, and approved job dependencies.
- Separate pools and identities for CPU jobs and VPS edge services. Never run public pull-request code on a persistent worker.
- Worker bootstrap identity is short-lived and rotated. No long-lived cloud key or repository token is written to disk.
- Heartbeat reports agent version and available slots; server-side policy controls capabilities and concurrency.
- RemoteView is a separate, explicitly paired management channel. Do not treat an ordinary desktop automation connection as a worker control plane.

## Acceptance on a real host

Record host ID, OS release, kernel, architecture, agent version, pool, approved capabilities, service status, last successful heartbeat, and health lease. Confirm unauthorized registration is rejected, drain prevents new jobs, and revocation removes scheduling immediately.
