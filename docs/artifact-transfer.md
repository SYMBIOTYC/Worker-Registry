# Artifact transfer and execution receipts

Status: protocol requirements only. No object store or transfer endpoint is configured.

## Transfer rules

- Keep task payloads out of the Worker Registry. Registry records contain only bounded metadata and artifact references.
- Upload outputs to a dedicated object store using a unique job and attempt prefix. Workers receive short-lived, narrowly scoped upload/download URLs or equivalent workload identity.
- Record SHA-256, byte length, content type, producer job/attempt, worker ID, and creation time for each artifact.
- Reject path traversal, symlinks escaping the staging directory, duplicate keys with different digests, and artifacts above configured size limits.
- Verify the checksum after upload and again before consumption. Do not execute an artifact until its producing job is authorized and its receipt is verified.
- Apply retention and deletion policy by data class. Never place credentials, environment dumps, or runner diagnostics containing tokens in artifacts.

## Execution receipt

A completed attempt should produce an immutable receipt with the job ID, attempt ID, worker ID, worker-agent version, task image or source digest, start/end times, exit code, artifact digests, and a server-verifiable signature or authenticated control-plane record. A CI bootstrap receipt is not proof of production worker execution.
