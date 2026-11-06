const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

test("rejects a signed test-account charge before any database writes", async () => {
  const root = path.resolve(__dirname, "..");
  const controller = require.resolve(path.join(root, "controllers", "subscriptionWebhook.controller.js"));
  const ids = {
    User: require.resolve(path.join(root, "models", "User.js")),
    Payment: require.resolve(path.join(root, "models", "Payment.js")),
    WebhookEvent: require.resolve(path.join(root, "models", "WebhookEvent.js")),
    ReferralEarning: require.resolve(path.join(root, "models", "ReferralEarning.js")),
    ReferralRefundRecord: require.resolve(path.join(root, "models", "ReferralRefundRecord.js")),
    commission: require.resolve(path.join(root, "services", "referralCommission.js")),
    razorpay: require.resolve(path.join(root, "services", "razorpayService.js"))
  };
  const originals = new Map([...Object.values(ids), controller].map(id => [id, require.cache[id]]));
  const oldSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const mock = (id, value) => { require.cache[id] = { id, filename: id, loaded: true, exports: value }; };
  let writes = 0;
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = "unit-test-signing-secret";
    mock(ids.razorpay, { payments: { fetch: async () => { throw new Error("Payment not found in live account"); } } });
    mock(ids.User, { findOne: async () => { writes++; return null; } });
    mock(ids.Payment, { updateOne: async () => { writes++; } });
    mock(ids.WebhookEvent, { findOne: async () => { writes++; return null; }, create: async () => { writes++; }, findOneAndUpdate: async () => null });
    mock(ids.ReferralEarning, {});
    mock(ids.ReferralRefundRecord, {});
    mock(ids.commission, { recordReferralCommission: async () => { writes++; } });
    delete require.cache[controller];
    const { handleRazorpayWebhook } = require(controller);
    const body = Buffer.from(JSON.stringify({
      event: "subscription.charged",
      payload: {
        subscription: { entity: { id: "sub_other_account" } },
        payment: { entity: { id: "pay_other_account", status: "captured", currency: "INR", amount: 19900 } }
      }
    }));
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    let statusCode = 200;
    await handleRazorpayWebhook({
      body, headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_other_account" }
    }, {
      status(code) { statusCode = code; return this; },
      json() { return this; }
    });
    assert.notEqual(statusCode, 200, "Unverified payment must not be acknowledged");
    assert.equal(writes, 0, "Unverified payment must not touch production data");
  } finally {
    if (oldSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = oldSecret;
    for (const [id, cached] of originals) {
      if (cached) require.cache[id] = cached;
      else delete require.cache[id];
    }
  }
});
