const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("simultaneous payout requests cannot reserve the same earnings twice", async () => {
  const root = path.resolve(__dirname, "..");
  const routePath = require.resolve(path.join(root, "routes", "referralPayout.routes.js"));
  const ids = {
    mongoose: require.resolve("mongoose"),
    express: require.resolve("express"),
    auth: require.resolve(path.join(root, "middleware", "authMiddleware.js")),
    admin: require.resolve(path.join(root, "middleware", "adminMiddleware.js")),
    earnings: require.resolve(path.join(root, "models", "ReferralEarning.js")),
    payouts: require.resolve(path.join(root, "models", "ReferralPayoutRequest.js")),
    user: require.resolve(path.join(root, "models", "User.js"))
  };
  const previous = new Map([...Object.values(ids), routePath].map(id => [id, require.cache[id]]));
  const mock = (id, exports) => { require.cache[id] = { id, filename: id, loaded: true, exports }; };
  let postHandler;
  let reservationCount = 0;
  let creationCount = 0;
  let releaseBothReads;
  const bothReads = new Promise(resolve => { releaseBothReads = resolve; });
  let readCount = 0;
  let status = "eligible";
  try {
    mock(ids.mongoose, {
      startSession: async () => ({ withTransaction: async fn => fn(), endSession: async () => {} })
    });
    mock(ids.express, { Router: () => ({
      get() {}, patch() {}, post(route, ...handlers) {
        if (route === "/requests") postHandler = handlers.at(-1);
      }
    }) });
    mock(ids.auth, (_req, _res, next) => next());
    mock(ids.admin, (_req, _res, next) => next());
    mock(ids.user, {});
    mock(ids.earnings, {
      find: () => ({ session: async () => {
        readCount++;
        if (readCount === 2) releaseBothReads();
        await bothReads;
        // Simulate both transactions reading the same eligible snapshot.
        return [{ _id: "earning-1", commissionAmount: 199 }];
      } }),
      updateMany: async filter => {
        assert.equal(filter.status, "eligible");
        if (status !== "eligible") return { modifiedCount: 0 };
        status = "requested";
        reservationCount++;
        return { modifiedCount: 1 };
      }
    });
    mock(ids.payouts, {
      create: async () => {
        creationCount++;
        return [{ _id: "payout-" + creationCount }];
      }
    });
    delete require.cache[routePath];
    require(routePath);
    const invoke = async () => {
      let code = 200;
      let payload;
      await postHandler({ user: { id: "referrer-1" } }, {
        status(n) { code = n; return this; },
        json(x) { payload = x; return this; }
      });
      return { code, payload };
    };
    const responses = await Promise.all([invoke(), invoke()]);
    assert.equal(responses.filter(x => x.code === 201).length, 1);
    assert.equal(responses.filter(x => x.code === 409).length, 1);
    assert.equal(reservationCount, 1);
    assert.equal(creationCount, 1);
  } finally {
    for (const [id, cached] of previous) {
      if (cached) require.cache[id] = cached;
      else delete require.cache[id];
    }
  }
});
