const test = require("node:test");
const assert = require("node:assert/strict");
const { validateUpi, validateAccountName, encryptUpi, decryptUpi } = require("../services/referralPayoutDestination");

test("validates and normalizes UPI payout details", () => {
  assert.equal(validateUpi("  Creator.Name@OKBANK "), "creator.name@okbank");
  assert.equal(validateAccountName("  Test   Creator "), "Test Creator");
  for (const invalid of ["", "not-an-upi", "user@", "a@bad!", "user@bank/other"]) {
    assert.throws(() => validateUpi(invalid), /valid UPI ID/);
  }
  assert.throws(() => validateAccountName(""), /account holder/);
});

test("UPI destination is authenticated-encrypted with unique IVs", () => {
  const previous = process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY;
  try {
    process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY = "1".repeat(64);
    const first = encryptUpi("creator@okbank");
    const second = encryptUpi("creator@okbank");
    assert.notEqual(first, second);
    assert.equal(decryptUpi(first), "creator@okbank");
    assert.equal(decryptUpi(second), "creator@okbank");
    assert.equal(first.includes("creator@okbank"), false);
    const segments = first.split(".");
    segments[2] = segments[2].slice(0, -2) + "AA";
    assert.throws(() => decryptUpi(segments.join(".")));
    process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY = "";
    assert.throws(() => encryptUpi("creator@okbank"), /ENCRYPTION_KEY/);
  } finally {
    if (previous === undefined) delete process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY;
    else process.env.REFERRAL_PAYOUT_ENCRYPTION_KEY = previous;
  }
});
