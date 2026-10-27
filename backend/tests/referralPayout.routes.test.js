const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const routePath = path.join(repoRoot, "routes", "referralPayout.routes.js");
const routeModuleId = require.resolve(routePath);

function loadRouterWithMocks({ payout, updateMany }) {
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
    find: () => ({ session: async () => [] })
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
    assert.equal(typeof loaded.handler, "function");
    let statusCode = 200;
    let body;
    const res = {
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; }
    };
    await loaded.handler(
      { params: { id: "payout-id" }, body: { action: "reject" }, user: { id: "admin-id" } },
      res
    );

    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
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
