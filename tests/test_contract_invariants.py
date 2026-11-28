"""Contract-level safety invariants for the Symbiotyc Worker Registry.

These tests validate the published OpenAPI contract only. They do not exercise
or imply a deployed registry service.
"""
import json
import unittest
from pathlib import Path


SPEC_PATH = Path(__file__).parents[1] / "contracts" / "worker-registry.openapi.json"


class WorkerRegistryContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
        cls.paths = cls.spec["paths"]
        cls.schemas = cls.spec["components"]["schemas"]

    def operation(self, path, method="post"):
        return self.paths[path][method]

    def test_only_bearer_jwt_is_declared_for_worker_identity(self):
        schemes = self.spec["components"]["securitySchemes"]
        self.assertEqual(set(schemes), {"WorkerIdentity"})
        identity = schemes["WorkerIdentity"]
        self.assertEqual(identity["type"], "http")
        self.assertEqual(identity["scheme"], "bearer")
        self.assertEqual(identity["bearerFormat"], "JWT")
        description = identity["description"].lower()
        for claim in ("signature", "issuer", "audience", "expiry"):
            self.assertIn(claim, description)

    def test_only_health_probes_are_public(self):
        for path, path_item in self.paths.items():
            for method, operation in path_item.items():
                if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                    continue
                if path in {"/healthz", "/readyz"}:
                    self.assertEqual(operation.get("security", []), [], path)
                else:
                    self.assertTrue(operation.get("security"), f"{method.upper()} {path}")
                    self.assertIn("x-required-roles", operation, f"{method.upper()} {path}")

    def test_registration_is_idempotent_and_starts_pending(self):
        operation = self.operation("/v1/workers")
        parameters = {p["name"]: p for p in operation["parameters"]}
        key = parameters["Idempotency-Key"]
        self.assertTrue(key["required"])
        self.assertGreaterEqual(key["schema"]["minLength"], 16)
        self.assertLessEqual(key["schema"]["maxLength"], 128)
        self.assertEqual(operation["responses"]["202"]["description"],
                         "Pending registration; not schedulable")

        registration = self.schemas["WorkerRegistration"]
        self.assertFalse(registration["additionalProperties"])
        props = registration["properties"]
        self.assertIn("requested_capabilities", props)
        self.assertIn("requested_max_concurrency", props)
        for forbidden in ("capabilities", "max_concurrency", "state",
                          "approved", "trust_level", "provider_subject"):
            self.assertNotIn(forbidden, props)

    def test_heartbeat_cannot_change_approval_or_lifecycle(self):
        heartbeat = self.schemas["HeartbeatRequest"]
        self.assertFalse(heartbeat["additionalProperties"])
        self.assertEqual(set(heartbeat["properties"]),
                         {"agent_version", "available_slots"})
        self.assertEqual(set(heartbeat["required"]),
                         {"agent_version", "available_slots"})
        self.assertEqual(heartbeat["properties"]["available_slots"]["minimum"], 0)

    def test_heartbeat_response_uses_server_time_and_explicit_schedulability(self):
        response = self.schemas["HeartbeatResponse"]
        self.assertTrue({"worker_id", "state", "schedulable", "server_time",
                         "heartbeat_interval_seconds"}.issubset(set(response["required"])))
        self.assertEqual(response["properties"]["schedulable"]["type"], "boolean")
        self.assertEqual(response["properties"]["server_time"]["format"], "date-time")
        interval = response["properties"]["heartbeat_interval_seconds"]
        self.assertGreaterEqual(interval["minimum"], 5)
        self.assertLessEqual(interval["maximum"], 300)

    def test_approval_is_admin_only_and_sets_server_approved_limits(self):
        operation = self.operation("/v1/workers/{worker_id}/approve")
        self.assertIn("workers:admin", operation["x-required-roles"])
        approval = self.schemas["Approval"]
        self.assertFalse(approval["additionalProperties"])
        self.assertEqual(set(approval["properties"]), {"capabilities", "max_concurrency"})
        self.assertIn("capabilities", approval["required"])
        self.assertIn("max_concurrency", approval["required"])

    def test_drain_and_revoke_are_admin_only(self):
        for suffix in ("drain", "revoke"):
            operation = self.operation(f"/v1/workers/{{worker_id}}/{suffix}")
            self.assertIn("workers:admin", operation["x-required-roles"])

    def test_registry_contract_does_not_expose_dispatch_or_job_execution(self):
        for path in self.paths:
            self.assertNotIn("/jobs", path)
            self.assertNotIn("/dispatch", path)

    def test_worker_separates_requested_and_approved_capabilities(self):
        worker = self.schemas["Worker"]
        props = worker["properties"]
        self.assertIn("requested_capabilities", props)
        self.assertIn("capabilities", props)
        self.assertIn("server-approved", props["capabilities"].get("description", "").casefold())
        self.assertEqual(props["state"]["enum"],
                         ["pending", "online", "draining", "unhealthy", "revoked"])
        self.assertGreaterEqual(props["max_concurrency"]["minimum"], 0)
        self.assertGreaterEqual(props["available_slots"]["minimum"], 0)


if __name__ == "__main__":
    unittest.main()
