import test from "node:test";
import assert from "node:assert/strict";
import { validateStagingMongoConfig, probeStagingMongo, inspectStagingCollections } from "./staging-mongodb.js";
const uri = "mongodb+srv://staging:password@cluster.example.net/triggerdm_staging?retryWrites=true";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: uri };
test("rejects production and mismatched MongoDB URI databases", () => {
  for (const name of ["automationDB", "admin", "triggerdm_staging_../../automationDB"]) {
    assert.throws(() => validateStagingMongoConfig({ ...env, MONGODB_STAGING_DB: name }));
  }
  assert.throws(() => validateStagingMongoConfig({ ...env, MONGODB_STAGING_URI: uri.replace("/triggerdm_staging?", "/automationDB?") }), /STAGING_URI_DATABASE_MISMATCH/);
  assert.equal(validateStagingMongoConfig(env).dbName, "triggerdm_staging");
});
test("read-only ping opens and closes a client", async () => {
  const commands = [];
  class Client {
    async connect() { commands.push("connect"); }
    db(name) { assert.equal(name, "triggerdm_staging"); return { command: async cmd => commands.push(cmd) }; }
    async close() { commands.push("close"); }
  }
  const result = await probeStagingMongo(env, Client);
  assert.equal(result.ok, true);
  assert.deepEqual(commands, ["connect", { ping: 1 }, "close"]);
});
test("schema inspection returns only collection presence and closes connection", async () => {
  let closed = false;
  class Client {
    async connect() {}
    db(name) { assert.equal(name, "triggerdm_staging"); return {
      async command(command) { assert.deepEqual(command, { ping: 1 }); },
      listCollections() { return { async toArray() { return [{ name: "users" }, { name: "campaigns" }]; } }; },
    }; }
    async close() { closed = true; }
  }
  const result = await inspectStagingCollections(env, Client);
  assert.equal(result.checks.users, true);
  assert.equal(result.checks.rules, false);
  assert.equal(closed, true);
});
