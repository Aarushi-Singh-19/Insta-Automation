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
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_DB: "triggerdm_staging_backup" }), /PRODUCTION_DATABASE_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_DB: "admin" }), /PRODUCTION_DATABASE_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_DB: "" }), /PRODUCTION_DATABASE_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_URI: "mongodb+srv://app:password@cluster.example.net/triggerdm_staging" }), /PRODUCTION_URI_DATABASE_MISMATCH/);
});
test("production database accepts explicit isolated production configuration", () => {
  assert.equal(validateProductionMongoConfig(base).dbName, "automationDB");
  assert.equal(validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_DB: "triggerdm_live", MONGODB_PRODUCTION_URI: "mongodb+srv://app:password@cluster.example.net/triggerdm_live" }).dbName, "triggerdm_live");
});
test("production database rejects malformed or credentialless URI", () => {
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_URI: "not-a-uri" }), /PRODUCTION_MONGODB_URI_REQUIRED/);
  assert.throws(() => validateProductionMongoConfig({ ...base, MONGODB_PRODUCTION_URI: "mongodb://cluster.example.net/automationDB" }), /PRODUCTION_CREDENTIALS_REQUIRED/);
});

test("read-only preflight can run without enabling production writes", () => {
  const env = { ...base, PRODUCTION_CUTOVER_APPROVED: "false", PRODUCTION_READ_ONLY_PROBE_ENABLED: "true" };
  assert.equal(validateProductionMongoConfig(env, { readOnlyProbe: true }).dbName, "automationDB");
  assert.throws(() => validateProductionMongoConfig(env), /PRODUCTION_CUTOVER_NOT_APPROVED/);
});
