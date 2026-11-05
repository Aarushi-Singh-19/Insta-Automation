// Opt-in real MongoDB integration test. NEVER point this at production/staging.
// Use a disposable replica-set MongoDB URI with database triggerdm_referral_integration_test.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const uri = process.env.REFERRAL_TEST_MONGODB_URI;
const dbName = "triggerdm_referral_integration_test";

test("real MongoDB: duplicate payment IDs and concurrent payout reservations", { skip: !uri && "Set REFERRAL_TEST_MONGODB_URI to an isolated test database" }, async () => {
  const parsed = new URL(uri);
  const actualDb = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  assert.equal(actualDb, dbName, "Refusing to run against any database other than the dedicated integration-test database");
  assert.notEqual(process.env.MONGODB_URI, uri, "Test URI must not match application database URI");
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 6000 }).asPromise();
  const suffix = new mongoose.Types.ObjectId().toString();
  const collectionName = "referral_integration_" + suffix;
  const schema = new mongoose.Schema({
    paymentId: { type: String, unique: true, required: true },
    status: { type: String, default: "eligible" },
    commissionAmount: Number
  });
  const Earning = connection.model("IntegrationEarning_" + suffix, schema, collectionName);
  try {
    await Earning.init();
    const paymentId = "pay_test_" + suffix;
    const inserts = await Promise.allSettled([
      Earning.create({ paymentId, commissionAmount: 199 }),
      Earning.create({ paymentId, commissionAmount: 199 })
    ]);
    assert.equal(inserts.filter(x => x.status === "fulfilled").length, 1, "Unique payment index must prevent duplicate earnings");
    assert.equal(inserts.filter(x => x.status === "rejected" && x.reason?.code === 11000).length, 1);

    // Use actual MongoDB transactions; two contenders attempt to reserve the same earning.
    const attempt = async () => {
      const session = await connection.startSession();
      try {
        return await session.withTransaction(async () => {
          const earning = await Earning.findOne({ paymentId, status: "eligible" }).session(session);
          if (!earning) return false;
          const result = await Earning.updateOne(
            { _id: earning._id, status: "eligible" },
            { $set: { status: "requested" } },
            { session }
          );
          return result.modifiedCount === 1;
        });
      } finally {
        await session.endSession();
      }
    };
    const results = await Promise.allSettled([attempt(), attempt()]);
    assert.equal(results.filter(x => x.status === "fulfilled" && x.value === true).length, 1, "Only one payout reservation should succeed");
    assert.equal(await Earning.countDocuments({ paymentId, status: "requested" }), 1);
  } finally {
    await connection.dropCollection(collectionName).catch(error => {
      if (error.codeName !== "NamespaceNotFound") throw error;
    });
    await connection.close();
  }
});
