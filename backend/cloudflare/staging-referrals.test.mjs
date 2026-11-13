import test from "node:test";
import assert from "node:assert/strict";
import { referralConfig, recordCommission, reverseRefund } from "./staging-referrals.js";

test("referrals disabled by default", () => {
  assert.throws(() => referralConfig({ MONGODB_STAGING_DB: "triggerdm_staging" }), /REFERRALS_DISABLED/);
});
test("non-referral and invalid-price payments never earn commission", async () => {
  let writes = 0;
  const db = { collection() { writes++; throw Error("unexpected database write"); } };
  await recordCommission(db, null, { referredBy: null }, { id: "pay_1", status: "captured", currency: "INR", amount: 19900 });
  await recordCommission(db, null, { referredBy: "aaaaaaaaaaaaaaaaaaaaaaaa" }, { id: "pay_2", status: "captured", currency: "INR", amount: 10000 });
  await recordCommission(db, null, { referredBy: "aaaaaaaaaaaaaaaaaaaaaaaa" }, { id: "pay_3", status: "failed", currency: "INR", amount: 19900 });
  assert.equal(writes, 0);
});
test("duplicate commission does not apply recovery twice", async () => {
  let recoveryReads = 0;
  const db = { collection(name) {
    assert.equal(name, "referralearnings");
    return { updateOne: async () => ({ upsertedCount: 0 }),
      find: () => { recoveryReads++; throw Error("recovery must not run for duplicate"); } };
  } };
  await recordCommission(db, {}, { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", referredBy: "aaaaaaaaaaaaaaaaaaaaaaaa" },
    { id: "pay_1", status: "captured", currency: "INR", amount: 19900 });
  assert.equal(recoveryReads, 0);
});
test("refund requires verified, positive amount and payment id", async () => {
  await assert.rejects(reverseRefund({}, null, { id: "rfnd_1", amount: 0 }), /INVALID_REFUND/);
});
