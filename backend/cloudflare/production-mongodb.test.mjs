import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionMongoConfig } from "./production-mongodb.js";

const base = {
  TRIGGERDM_RUNTIME: "production", PRODUCTION_CUTOVER_APPROVED: "true",
  MONGODB_PRODUCTION_DB: "automationDB",
  MONGODB_PRODUCTION_URI: "mongodb+srv://app:password@cluster.example.net/automationDB"
};

test("production database requires explicit runtime and approval", () => {
  assert.throws(() => validateProductionMongoConfig({ ...base, TRIGGERDM_RUNTIME: "staging" }), /PRODUCTION_RUNTIME_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, PRODUCTION_CUTOVER_APPROVED: "false" }), /PRODUCTION_CUTOVER_NOT_APPROVED/);
});
test("production database rejects Render fallback and staging database", () => {
  assert.throws(() => validateProductionMongoConfig({ ...base, UPSTREAM_ORIGIN: "https://example.com" }), /RENDER_DEPENDENCY/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_DB: "triggerdm_staging" }), /PRODUCTION_DATABASE_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_URI: "mongodb+srv://app:password@cluster.example.net/triggerdm_staging" }), /PRODUCTION_URI_DATABASE_MISMATCH/);
});
test("production database accepts explicit isolated production configuration", () => {
  const result = validateProductionMongoConfig(base);
  assert.equal(result.dbName, "automationDB");
});
