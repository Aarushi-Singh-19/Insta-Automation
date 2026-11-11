import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { loginStagingUser, issueStagingJwt } from "./staging-login.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
const id = "507f1f77bcf86cd799439011";
const env = { MONGODB_STAGING_DB: "triggerdm_staging", MONGODB_STAGING_URI: "mongodb+srv://u:p@cluster.example.net/triggerdm_staging", STAGING_JWT_SECRET: "isolated-staging-secret-for-test-only" };
test("native login validates bcrypt and issues a compatible signed token", async () => {
  const hashed = await bcrypt.hash("fixture-password", 4);
  let closed = false;
  class Client {
    async connect() {}
    db(name) {
      assert.equal(name, "triggerdm_staging");
      return { collection(table) {
        assert.equal(table, "users");
        return { async findOne(filter) {
          assert.equal(filter.email, "fixture@example.com");
          return { _id: new ObjectId(id), name: "Fixture", email: filter.email, password: hashed,
            accessToken: "never-return", subscriptionStatus: "trial" };
        } };
      } };
    }
    async close() { closed = true; }
  }
  const oldCrypto = globalThis.crypto;
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  try {
    const result = await loginStagingUser({ env, MongoClient: Client, email: " FIXTURE@example.com ", password: "fixture-password" });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.password, undefined);
    assert.equal(result.body.user.accessToken, undefined);
    assert.equal(getTriggerDmUserId(await verifySessionJwt(result.body.token, env.STAGING_JWT_SECRET)), id);
    assert.equal(closed, true);
  } finally { if (!oldCrypto) delete globalThis.crypto; }
});
test("native login rejects missing credentials without DB access", async () => {
  const result = await loginStagingUser({ env, MongoClient: class {}, email: "", password: "" });
  assert.equal(result.status, 400);
});
