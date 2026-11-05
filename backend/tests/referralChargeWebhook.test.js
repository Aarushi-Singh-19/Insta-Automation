const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

test("subscription charge invokes referral commission recording successfully", async () => {
  const root = path.resolve(__dirname, "..");
  const controller = require.resolve(path.join(root, "controllers", "subscriptionWebhook.controller.js"));
  const ids = {
    User: require.resolve(path.join(root, "models", "User.js")),
    Payment: require.resolve(path.join(root, "models", "Payment.js")),
    WebhookEvent: require.resolve(path.join(root, "models", "WebhookEvent.js")),
    ReferralEarning: require.resolve(path.join(root, "models", "ReferralEarning.js")),
    ReferralRefundRecord: require.resolve(path.join(root, "models", "ReferralRefundRecord.js")),
    commission: require.resolve(path.join(root, "services", "referralCommission.js"))
  };
  const originals = new Map([...Object.values(ids), controller].map(id => [id, require.cache[id]]));
  const oldSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  let commissionCalls = 0;
  const user = { _id: "user-1", referredBy: "referrer-1", save: async () => {} };
  const mock = (id, exports) => { require.cache[id] = { id, filename: id, loaded: true, exports }; };
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = "mock-test-secret";
    mock(ids.User, { findOne: async () => user });
    mock(ids.Payment, { updateOne: async () => ({}) });
    mock(ids.WebhookEvent, {
      findOne: async () => null,
      create: async () => ({}),
      findOneAndUpdate: async () => ({})
    });
    mock(ids.ReferralEarning, {});
    mock(ids.ReferralRefundRecord, {});
    mock(ids.commission, {
      recordReferralCommission: async () => { commissionCalls++; }
    });
    delete require.cache[controller];
    const { handleRazorpayWebhook } = require(controller);
    const body = Buffer.from(JSON.stringify({
      event: "subscription.charged",
      payload: {
        subscription: { entity: { id: "sub_mock" } },
        payment: { entity: { id: "pay_mock", status: "captured", currency: "INR", amount: 19900 } }
      }
    }));
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; }
    };
    await handleRazorpayWebhook({
      body,
      headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_charge_mock" }
    }, res);
    assert.equal(statusCode, 200, "Valid subscription charge should complete successfully");
    assert.equal(commissionCalls, 1, "Charge must call commission recording once");
  } finally {
    if (oldSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = oldSecret;
    for (const [id, cached] of originals) {
      if (cached) require.cache[id] = cached;
      else delete require.cache[id];
    }
  }
});
