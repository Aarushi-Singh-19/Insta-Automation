const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

test("records a verified captured payment when webhook omits subscription_id", async () => {
  const root = path.resolve(__dirname, "..");
  const controller = require.resolve(path.join(root, "controllers/subscriptionWebhook.controller.js"));
  const names = ["User", "Payment", "WebhookEvent", "ReferralEarning", "ReferralRefundRecord"];
  const ids = Object.fromEntries(names.map(name => [name, require.resolve(path.join(root, "models", name + ".js"))]));
  ids.razorpay = require.resolve(path.join(root, "services/razorpayService.js"));
  ids.commission = require.resolve(path.join(root, "services/referralCommission.js"));

  const originals = new Map([...Object.values(ids), controller].map(id => [id, require.cache[id]]));
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const writes = [];
  const mock = (id, exports) => {
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };

  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = "isolated-test-secret";

    mock(ids.User, {
      findOne: async query =>
        query.razorpaySubscriptionId === "sub_test" ? { _id: "user_test" } : null
    });
    mock(ids.Payment, {
      updateOne: async (filter, update) => {
        writes.push({ filter, update });
        return {};
      }
    });
    mock(ids.WebhookEvent, {
      findOne: async () => null,
      create: async () => ({}),
      findOneAndUpdate: async () => ({})
    });
    mock(ids.razorpay, {
      payments: {
        fetch: async () => ({
          id: "pay_test",
          status: "captured",
          amount: 19900,
          currency: "INR",
          subscription_id: "sub_test"
        })
      }
    });
    mock(ids.ReferralEarning, {});
    mock(ids.ReferralRefundRecord, {});
    mock(ids.commission, { recordReferralCommission: async () => {} });

    delete require.cache[controller];
    const { handleRazorpayWebhook } = require(controller);

    const body = Buffer.from(JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test",
            status: "captured",
            amount: 19900,
            currency: "INR"
          }
        }
      }
    }));

    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body).digest("hex");

    let statusCode = 200;
    const res = {
      status(code) { statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };

    await handleRazorpayWebhook({
      body,
      headers: {
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": "evt_captured_test"
      }
    }, res);

    assert.equal(statusCode, 200);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].filter.razorpayPaymentId, "pay_test");
    assert.equal(writes[0].update.$setOnInsert.razorpaySubscriptionId, "sub_test");
    assert.equal(writes[0].update.$setOnInsert.amount, 199);
  } finally {
    if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;

    for (const [id, cached] of originals) {
      if (cached) require.cache[id] = cached;
      else delete require.cache[id];
    }
  }
});
