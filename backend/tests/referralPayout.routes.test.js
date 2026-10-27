const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const routePath = path.join(repoRoot, "routes", "referralPayout.routes.js");
const routeModuleId = require.resolve(routePath);

function loadRouterWithMocks({ payout, updateMany, earnings = [] }) {
  const mongooseId = require.resolve("mongoose");
  const expressId = require.resolve("express");
  const authPath = require.resolve(path.join(repoRoot, "middleware", "authMiddleware.js"));
  const adminPath = require.resolve(path.join(repoRoot, "middleware", "adminMiddleware.js"));
  const earningPath = require.resolve(path.join(repoRoot, "models", "ReferralEarning.js"));
  const payoutPath = require.resolve(path.join(repoRoot, "models", "ReferralPayoutRequest.js"));
  const userPath = require.resolve(path.join(repoRoot, "models", "User.js"));

  const original = new Map(
    [mongooseId, expressId, authPath, adminPath, earningPath, payoutPath, userPath, routeModuleId]
      .map((id) => [id, require.cache[id]])
  );
  let patchHandler;
  const router = {
    get() {},
    post() {},
    patch(route, ...handlers) {
      if (route === "/admin/requests/:id") patchHandler = handlers[handlers.length - 1];
    }
  };
  const fakeMongoose = {
    isValidObjectId: () => true,
    startSession: async () => ({
      withTransaction: async (callback) => callback(),
      endSession: async () => {}
    })
  };
  const fakeExpress = { Router: () => router };
  const fakeEarnings = {
    updateMany: async (...args) => {
      updateMany(...args);
      return { modifiedCount: 1 };
    },
    find: () => ({ session: async () => earnings })
  };
  const fakePayouts = {
    findById: () => ({ session: async () => payout })
  };

  function mock(id, exports) {
    require.cache[id] = { id, filename: id, loaded: true, exports };
  }

  mock(mongooseId, fakeMongoose);
  mock(expressId, fakeExpress);
  mock(authPath, (_req, _res, next) => next());
  mock(adminPath, (_req, _res, next) => next());
  mock(earningPath, fakeEarnings);
  mock(payoutPath, fakePayouts);
  mock(userPath, {});

  delete require.cache[routeModuleId];
  require(routePath);

  return {
    handler: patchHandler,
    restore() {
      for (const [id, cached] of original) {
        if (cached) require.cache[id] = cached;
        else delete require.cache[id];
      }
    }
  };
}

async function invoke(handler, body) {
  let statusCode = 200;
  let responseBody;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; return this; }
  };
  await handler(
    { params: { id: "payout-id" }, body, user: { id: "admin-id" } },
    res
  );
  return { statusCode, body: responseBody };
}

test("rejecting an approved unpaid payout releases only earnings still reserved as requested", async () => {
  const payout = {
    _id: "payout-id",
    referrerId: "referrer-id",
    earningIds: ["earning-requested", "earning-reversed"],
    status: "approved",
    async save() { return this; }
  };
  const calls = [];
  const loaded = loadRouterWithMocks({
    payout,
    updateMany: (...args) => calls.push(args)
  });

  try {
    const result = await invoke(loaded.handler, { action: "reject" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(payout.status, "rejected");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][0], {
      _id: { $in: ["earning-requested", "earning-reversed"] },
      referrerId: "referrer-id",
      status: "requested"
    });
    assert.deepEqual(calls[0][1], { $set: { status: "eligible" } });
    assert.equal(calls[0][2].session !== undefined, true);
  } finally {
    loaded.restore();
  }
});

test("refuses to mark an approved payout paid when a refund changed the reserved amount", async () => {
  const payout = {
    _id: "payout-id",
    referrerId: "referrer-id",
    earningIds: ["earning-id"],
    amount: 199,
    status: "approved",
    async save() { return this; }
  };
  const calls = [];
  const loaded = loadRouterWithMocks({
    payout,
    earnings: [{ _id: "earning-id", commissionAmount: 149, status: "requested" }],
    updateMany: (...args) => calls.push(args)
  });

  try {
    const result = await invoke(loaded.handler, {
      action: "paid",
      transferReference: "TEST-TRANSFER-REFERENCE"
    });
    assert.equal(result.statusCode, 409);
    assert.equal(result.body.success, false);
    assert.match(result.body.message, /changed after a refund/i);
    assert.equal(payout.status, "approved");
    assert.equal(calls.length, 0);
  } finally {
    loaded.restore();
  }
});
