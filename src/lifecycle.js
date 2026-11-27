const STATES = new Set(["pending", "online", "draining", "unhealthy", "revoked"]);

function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
}

function event(worker, type, actor, reason, at) {
  requireText(actor, "actor");
  requireText(reason, "reason");
  return {
    type,
    workerId: worker.workerId,
    actor,
    reason,
    occurredAt: at,
  };
}

function withEvent(worker, next, type, actor, reason, at) {
  return {
    ...next,
    auditEvents: [
      ...(worker.auditEvents ?? []),
      event(worker, type, actor, reason, at),
    ],
  };
}

export function registerWorker(input, now = Date.now()) {
  requireText(input?.workerId, "workerId");
  requireText(input?.principal?.subject, "authenticated principal subject");
  requireText(input?.pool, "pool");
  requireText(input?.agentVersion, "agentVersion");
  if (!["cpu", "vps"].includes(input.workerClass)) throw new Error("unsupported worker class");
  if (!["ubuntu-24.04", "debian-12"].includes(input.os)) throw new Error("unsupported operating system");
  if (!["x86_64", "arm64"].includes(input.architecture)) throw new Error("unsupported architecture");
  if (!Array.isArray(input.requestedCapabilities) || new Set(input.requestedCapabilities).size !== input.requestedCapabilities.length) {
    throw new Error("requestedCapabilities must be a unique array");
  }
  if (!Number.isInteger(input.requestedMaxConcurrency) || input.requestedMaxConcurrency < 1 || input.requestedMaxConcurrency > 128) {
    throw new Error("requestedMaxConcurrency must be between 1 and 128");
  }

  return {
    workerId: input.workerId,
    principalSubject: input.principal.subject,
    workerClass: input.workerClass,
    pool: input.pool,
    agentVersion: input.agentVersion,
    os: input.os,
    architecture: input.architecture,
    requestedCapabilities: [...input.requestedCapabilities],
    capabilities: [],
    requestedMaxConcurrency: input.requestedMaxConcurrency,
    maxConcurrency: 0,
    availableSlots: 0,
    state: "pending",
    createdAt: now,
    approvedAt: null,
    lastSeenAt: null,
    leaseExpiresAt: null,
    auditEvents: [{
      type: "worker.registered",
      workerId: input.workerId,
      actor: input.principal.subject,
      reason: "registration requested",
      occurredAt: now,
    }],
  };
}

export function approveWorker(worker, approval, now = Date.now()) {
  if (worker.state === "revoked") throw new Error("revoked worker cannot be approved");
  if (worker.state !== "pending") throw new Error("only pending workers can be approved");
  requireText(approval?.actor, "actor");
  requireText(approval?.reason, "reason");
  if (!Array.isArray(approval.capabilities) ||
      approval.capabilities.some((capability) => !worker.requestedCapabilities.includes(capability)) ||
      new Set(approval.capabilities).size !== approval.capabilities.length) {
    throw new Error("approved capabilities contain a capability not requested or a duplicate");
  }
  if (!Number.isInteger(approval.maxConcurrency) || approval.maxConcurrency < 1 ||
      approval.maxConcurrency > worker.requestedMaxConcurrency) {
    throw new Error("maxConcurrency exceeds requested maximum or is invalid");
  }

  return withEvent(worker, {
    ...worker,
    capabilities: [...approval.capabilities],
    maxConcurrency: approval.maxConcurrency,
    availableSlots: 0,
    approvedAt: now,
    state: "pending",
  }, "worker.approved", approval.actor, approval.reason, now);
}

export function heartbeatWorker(worker, heartbeat, config) {
  if (worker.state === "revoked") throw new Error("revoked worker cannot heartbeat");
  if (!worker.approvedAt) throw new Error("worker must be approved before heartbeat");
  requireText(heartbeat?.agentVersion, "agentVersion");
  const { now, leaseSeconds, heartbeatIntervalSeconds } = config ?? {};
  if (!Number.isFinite(now) || !Number.isInteger(leaseSeconds) || leaseSeconds < 5 ||
      !Number.isInteger(heartbeatIntervalSeconds) || heartbeatIntervalSeconds < 5 ||
      heartbeatIntervalSeconds > 300 || leaseSeconds < heartbeatIntervalSeconds * 2) {
    throw new Error("invalid heartbeat lease configuration");
  }
  if (!Number.isInteger(heartbeat.availableSlots) || heartbeat.availableSlots < 0 ||
      heartbeat.availableSlots > worker.maxConcurrency) {
    throw new Error("availableSlots exceeds approved maximum or is invalid");
  }

  const state = worker.state === "draining" ? "draining" : "online";
  return {
    ...worker,
    state,
    agentVersion: heartbeat.agentVersion,
    availableSlots: heartbeat.availableSlots,
    lastSeenAt: now,
    leaseExpiresAt: now + leaseSeconds * 1000,
    heartbeatIntervalSeconds,
  };
}

export function expireLeases(workers, now = Date.now()) {
  return workers.map((worker) => {
    if ((worker.state === "online" || worker.state === "draining") &&
        Number.isFinite(worker.leaseExpiresAt) && worker.leaseExpiresAt <= now) {
      return {
        ...worker,
        state: "unhealthy",
        availableSlots: 0,
        leaseExpiresAt: null,
        auditEvents: [
          ...(worker.auditEvents ?? []),
          {
            type: "worker.lease_expired",
            workerId: worker.workerId,
            actor: "system:lease-monitor",
            reason: "heartbeat lease expired",
            occurredAt: now,
          },
        ],
      };
    }
    return worker;
  });
}

export function drainWorker(worker, command, now = Date.now()) {
  if (worker.state === "revoked") throw new Error("revoked worker cannot be drained");
  if (!["online", "unhealthy"].includes(worker.state)) {
    throw new Error("only online or unhealthy workers can be drained");
  }
  return withEvent(worker, {
    ...worker,
    state: "draining",
    availableSlots: 0,
  }, "worker.draining", command.actor, command.reason, now);
}

export function revokeWorker(worker, command, now = Date.now()) {
  if (worker.state === "revoked") return worker;
  return withEvent(worker, {
    ...worker,
    state: "revoked",
    availableSlots: 0,
    leaseExpiresAt: null,
    revokedAt: now,
  }, "worker.revoked", command.actor, command.reason, now);
}

export function isSchedulable(worker, now = Date.now()) {
  return STATES.has(worker.state) &&
    worker.state === "online" &&
    worker.approvedAt !== null &&
    Number.isFinite(worker.leaseExpiresAt) &&
    worker.leaseExpiresAt > now &&
    worker.availableSlots > 0 &&
    worker.availableSlots <= worker.maxConcurrency &&
    worker.capabilities.length > 0;
}
