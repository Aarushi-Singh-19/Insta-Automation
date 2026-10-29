const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

test("refund arriving before commission must not be acknowledged as processed", async () => {
  const root = path.resolve(__dirname, "..");
  const controllerPath = path.join(root, "controllers", "subscriptionWebhook.controller.js");
  const dependencies = {
    mongoose: require.resolve("mongoose"),
    User: require.resolve(path.join(root, "models", "User.js")),
    Payment: require.resolve(path.join(root, "models", "Payment.js")),
    WebhookEvent: require.resolve(path.join(root, "models", "WebhookEvent.js")),
    ReferralEarning: require.resolve(path.join(root, "models", "ReferralEarning.js")),
    ReferralRefundRecord: require.resolve(path.join(root, "models", "ReferralRefundRecord.js")),
  };
  const ids = [...Object.values(dependencies), require.resolve(controllerPath)];
  const previous = new Map(ids.map(id => [id, require.cache[id]]));
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const processed = [];
  const mock = (id, exports) => { require.cache[id] = { id, filename: id, loaded: true, exports }; };
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = "mock-test-secret";
    mock(dependencies.mongoose, {
      startSession: async () => ({
        withTransaction: async callback => callback(),
        endSession: async () => {}
      })
    });
    mock(dependencies.User, {});
    mock(dependencies.Payment, {});
    mock(dependencies.WebhookEvent, {
      findOne: async () => null,
      create: async () => ({}),
      findOneAndUpdate: async (query, update) => {
        if (update.$set?.status === "processed") processed.push(query.eventId);
        return {};
      }
    });
    mock(dependencies.ReferralEarning, {
      findOne: () => ({ session: async () => null })
    });
    mock(dependencies.ReferralRefundRecord, {
      findOne: () => ({ lean: async () => null })
    });
    delete require.cache[require.resolve(controllerPath)];
    const { handleRazorpayWebhook } = require(controllerPath);
    const body = Buffer.from(JSON.stringify({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_early_test", payment_id: "pay_missing_test", amount: 19900 } } }
    }));
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    let statusCode = 200;
    const req = { body, headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_early_refund_test" } };
    const res = {
      status(code) { statusCode = code; return this; },
      json(value) { this.payload = value; return this; }
    };
    await handleRazorpayWebhook(req, res);
    assert.notEqual(statusCode, 200, "Missing commission must trigger retry, not HTTP 200");
    assert.deepEqual(processed, [], "Refund event must not be marked processed");
  } finally {
    if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
    for (const [id, cached] of previous) {
      if (cached) require.cache[id] = cached;
      else delete require.cache[id];
    }
  }
});
