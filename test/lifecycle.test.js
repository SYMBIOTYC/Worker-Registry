import test from "node:test";
import assert from "node:assert/strict";
import {
  registerWorker,
  approveWorker,
  heartbeatWorker,
  expireLeases,
  drainWorker,
  revokeWorker,
  isSchedulable,
} from "../src/lifecycle.js";

const principal = { subject: "spiffe://symbiotyc/worker/cpu-01" };
const registration = {
  workerId: "worker-001",
  principal,
  workerClass: "cpu",
  pool: "cpu-general",
  agentVersion: "0.1.0",
  os: "ubuntu-24.04",
  architecture: "x86_64",
  requestedCapabilities: ["build", "render"],
  requestedMaxConcurrency: 4,
};

function approvedWorker(now = 1_000) {
  const pending = registerWorker(registration, now);
  return approveWorker(pending, {
    capabilities: ["build"],
    maxConcurrency: 2,
    actor: "admin:operator-1",
    reason: "initial review passed",
  }, now);
}

test("registration creates a pending, non-schedulable worker", () => {
  const worker = registerWorker(registration, 1_000);
  assert.equal(worker.state, "pending");
  assert.deepEqual(worker.capabilities, []);
  assert.equal(worker.maxConcurrency, 0);
  assert.equal(isSchedulable(worker, 1_000), false);
});

test("approval accepts only requested capabilities and a bounded concurrency", () => {
  const pending = registerWorker(registration, 1_000);
  assert.throws(() => approveWorker(pending, {
    capabilities: ["admin"],
    maxConcurrency: 2,
    actor: "admin:operator-1",
    reason: "review",
  }, 1_000), /not requested/);
  assert.throws(() => approveWorker(pending, {
    capabilities: ["build"],
    maxConcurrency: 5,
    actor: "admin:operator-1",
    reason: "review",
  }, 1_000), /requested maximum/);
});

test("heartbeat renews a server-clock lease and enables an approved worker", () => {
  const worker = approvedWorker(1_000);
  const renewed = heartbeatWorker(worker, {
    agentVersion: "0.1.1",
    availableSlots: 2,
  }, { now: 2_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 });
  assert.equal(renewed.state, "online");
  assert.equal(renewed.lastSeenAt, 2_000);
  assert.equal(renewed.leaseExpiresAt, 32_000);
  assert.equal(isSchedulable(renewed, 2_001), true);
});

test("heartbeat cannot exceed approved capacity or revive a revoked worker", () => {
  const worker = approvedWorker();
  assert.throws(() => heartbeatWorker(worker, {
    agentVersion: "0.1.0", availableSlots: 3,
  }, { now: 2_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 }), /approved maximum/);
  const revoked = revokeWorker(worker, {
    actor: "admin:operator-1", reason: "compromised host",
  }, 2_000);
  assert.throws(() => heartbeatWorker(revoked, {
    agentVersion: "0.1.0", availableSlots: 0,
  }, { now: 3_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 }), /revoked/);
});

test("lease expiry makes an online worker unhealthy and unschedulable", () => {
  const worker = heartbeatWorker(approvedWorker(), {
    agentVersion: "0.1.0", availableSlots: 1,
  }, { now: 2_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 });
  const expired = expireLeases([worker], 32_000);
  assert.equal(expired[0].state, "unhealthy");
  assert.equal(isSchedulable(expired[0], 32_000), false);
});

test("drain prevents new scheduling and is not undone by heartbeat", () => {
  const worker = heartbeatWorker(approvedWorker(), {
    agentVersion: "0.1.0", availableSlots: 1,
  }, { now: 2_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 });
  const draining = drainWorker(worker, {
    actor: "admin:operator-1", reason: "maintenance window",
  }, 3_000);
  assert.equal(draining.state, "draining");
  assert.equal(isSchedulable(draining, 3_001), false);
  const stillDraining = heartbeatWorker(draining, {
    agentVersion: "0.1.1", availableSlots: 1,
  }, { now: 4_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 });
  assert.equal(stillDraining.state, "draining");
  assert.equal(isSchedulable(stillDraining, 4_001), false);
});

test("revocation is terminal and immediately excludes the worker", () => {
  const worker = heartbeatWorker(approvedWorker(), {
    agentVersion: "0.1.0", availableSlots: 1,
  }, { now: 2_000, leaseSeconds: 30, heartbeatIntervalSeconds: 10 });
  const revoked = revokeWorker(worker, {
    actor: "admin:operator-1", reason: "security incident",
  }, 3_000);
  assert.equal(revoked.state, "revoked");
  assert.equal(isSchedulable(revoked, 3_001), false);
  assert.throws(() => drainWorker(revoked, {
    actor: "admin:operator-1", reason: "maintenance",
  }, 4_000), /revoked/);
});
