import { recordCommission, reverseRefund } from "./staging-referrals.js";
import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { verifyHmacSha256 } from "./webhook-security.js";

// Native staging billing. Deliberately refuses production DBs and unconfigured
// credentials. Razorpay API verification is mandatory before granting access.
export function billingConfig(env) {
  const db = validateStagingMongoConfig(env);
  if (env?.ENABLE_STAGING_RAZORPAY !== "true") throw new Error("BILLING_DISABLED");
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET ||
      !env.RAZORPAY_MONTHLY_PLAN_ID || !env.RAZORPAY_WEBHOOK_SECRET)
    throw new Error("BILLING_NOT_CONFIGURED");
  return db;
}
export async function razorpayApi(env, method, path, { fetchImpl = fetch, body } = {}) {
  const auth = btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
  const response = await fetchImpl("https://api.razorpay.com/v1/" + path, {
    method, headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error("RAZORPAY_API_UNAVAILABLE");
  return response.json();
}
const subscriptionResponse = s => ({ success: true, subscription: {
  id: s.id, planId: s.plan_id, status: s.status, startAt: s.start_at
} });
export async function createStagingSubscription({ env, MongoClient, userId, fetchImpl = fetch }) {
  const { uri, dbName } = billingConfig(env);
  if (!/^[a-f0-9]{24}$/i.test(userId)) return { status: 401, data: { success: false, message: "Unauthorized" } };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const users = client.db(dbName).collection("users");
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) return { status: 404, data: { success: false, message: "User not found" } };
    if (user.subscriptionStatus === "active" && user.planEndDate &&
        new Date(user.planEndDate).getTime() > Date.now())
      return { status: 400, data: { success: false, message: "Subscription already active" } };
    if (user.razorpaySubscriptionId) {
      const existing = await razorpayApi(env, "GET", "subscriptions/" +
        encodeURIComponent(user.razorpaySubscriptionId), { fetchImpl });
      if (["created", "authenticated", "pending"].includes(existing.status))
        return { status: 200, data: subscriptionResponse(existing) };
    }
    const subscription = await razorpayApi(env, "POST", "subscriptions", { fetchImpl,
      body: { plan_id: env.RAZORPAY_MONTHLY_PLAN_ID, total_count: 120,
        quantity: 1, customer_notify: true, notes: { userId, email: user.email } } });
    if (!subscription?.id || !subscription?.plan_id) throw new Error("INVALID_RAZORPAY_RESPONSE");
    // Compare-and-swap prevents overwriting a concurrent subscription ID.
    const saved = await users.updateOne({ _id: user._id,
      razorpaySubscriptionId: user.razorpaySubscriptionId ?? null },
      { $set: { razorpaySubscriptionId: subscription.id } });
    if (saved.modifiedCount !== 1) throw new Error("SUBSCRIPTION_CONCURRENT_CREATION");
    return { status: 200, data: subscriptionResponse(subscription) };
  } finally { await client.close(); }
}
export async function stagingPaymentHistory({ env, MongoClient, userId }) {
  const { uri, dbName } = billingConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const payments = await client.db(dbName).collection("payments")
      .find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).limit(100).toArray();
    return { success: true, payments };
  } finally { await client.close(); }
}
function dateFromEpoch(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}
export function subscriptionUpdate(type, subscription) {
  const fields = {};
  if (type === "subscription.activated" || type === "subscription.charged") {
    fields.subscriptionStatus = "active";
    fields.currentPlan = "starter";
    if (subscription.current_start) fields.subscriptionCurrentStart = dateFromEpoch(subscription.current_start);
    if (subscription.current_end) {
      fields.subscriptionCurrentEnd = dateFromEpoch(subscription.current_end);
      fields.planEndDate = fields.subscriptionCurrentEnd;
    }
  } else if (type === "subscription.pending" || type === "payment.failed") {
    fields.subscriptionStatus = "past_due";
  } else if (["subscription.halted", "subscription.cancelled", "subscription.completed"].includes(type)) {
    fields.subscriptionStatus = type === "subscription.halted" ? "halted" :
      type === "subscription.cancelled" ? "cancelled" : "expired";
    if (subscription.current_end) {
      fields.subscriptionCurrentEnd = dateFromEpoch(subscription.current_end);
      fields.planEndDate = fields.subscriptionCurrentEnd;
    }
  }
  return fields;
}
async function verifyCaptured(env, payment, subscriptionId, fetchImpl) {
  if (!payment?.id || payment.status !== "captured" || !Number.isFinite(payment.amount) ||
      payment.amount < 0 || !payment.currency) throw new Error("INVALID_CAPTURED_PAYMENT");
  const verified = await razorpayApi(env, "GET", "payments/" + encodeURIComponent(payment.id), { fetchImpl });
  if (verified.id !== payment.id || verified.status !== "captured" ||
      verified.amount !== payment.amount || verified.currency !== payment.currency)
    throw new Error("PAYMENT_VERIFICATION_MISMATCH");
  let verifiedSubscription = verified.subscription_id;
  if (!verifiedSubscription && verified.invoice_id) {
    const invoice = await razorpayApi(env, "GET", "invoices/" +
      encodeURIComponent(verified.invoice_id), { fetchImpl });
    if (invoice.id !== verified.invoice_id || invoice.payment_id !== payment.id ||
        invoice.status !== "paid" || invoice.amount !== payment.amount ||
        invoice.currency !== payment.currency || !invoice.subscription_id)
      throw new Error("INVOICE_VERIFICATION_MISMATCH");
    verifiedSubscription = invoice.subscription_id;
  }
  if (!verifiedSubscription || (subscriptionId && verifiedSubscription !== subscriptionId))
    throw new Error("SUBSCRIPTION_VERIFICATION_MISMATCH");
  return { payment: verified, subscriptionId: verifiedSubscription };
}
export async function processStagingRazorpayWebhook({ request, env, MongoClient, fetchImpl = fetch }) {
  const { uri, dbName } = billingConfig(env);
  const raw = await request.text();
  if (raw.length > 256000) return { status: 413, data: { success: false } };
  if (!await verifyHmacSha256(raw, request.headers.get("x-razorpay-signature"),
      env.RAZORPAY_WEBHOOK_SECRET)) return { status: 403, data: { success: false, message: "Invalid signature" } };
  let event;
  try { event = JSON.parse(raw); } catch { return { status: 400, data: { success: false } }; }
  const eventId = request.headers.get("x-razorpay-event-id") || event.id;
  const type = event.event;
  if (!eventId || typeof eventId !== "string" || eventId.length > 200 || !type)
    return { status: 400, data: { success: false } };
  const subscription = event.payload?.subscription?.entity;
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;
  const supported = new Set(["subscription.authenticated", "subscription.activated",
    "subscription.charged", "subscription.pending", "subscription.halted",
    "subscription.cancelled", "subscription.completed", "payment.captured", "payment.failed", "refund.processed"]);
  if (!supported.has(type)) return { status: 503, data: { success: false, message: "Event type not migrated" } };
  if (type.startsWith("subscription.") && !subscription?.id)
    return { status: 400, data: { success: false, message: "Missing subscription" } };
  let captured;
  try {
    if (type === "subscription.charged" || type === "payment.captured")
      captured = await verifyCaptured(env, payment, subscription?.id, fetchImpl);
  } catch { return { status: 503, data: { success: false, message: "Payment verification failed" } }; }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  let claimed = false;
  try {
    await client.connect();
    const db = client.db(dbName);
    // Enforce database idempotency even when Mongoose has never initialized indexes.
    await Promise.all([
      db.collection("webhookevents").createIndex({ eventId: 1 }, { unique: true }),
      db.collection("payments").createIndex({ razorpayPaymentId: 1 }, { unique: true }),
      db.collection("referralearnings").createIndex({ razorpayPaymentId: 1 }, { unique: true }),
      db.collection("referralrefundrecords").createIndex({ razorpayRefundId: 1 }, { unique: true })
    ]);
    const users = db.collection("users");
    const events = db.collection("webhookevents");
    const subscriptionId = subscription?.id || captured?.subscriptionId || payment?.subscription_id;
    const user = subscriptionId ? await users.findOne({ razorpaySubscriptionId: subscriptionId }) : null;
    if (!user && type !== "subscription.authenticated" && type !== "refund.processed")
      return { status: 503, data: { success: false, message: "Subscription owner not found" } };
    if (type === "subscription.charged" && user?.referredBy && env.ENABLE_STAGING_REFERRALS !== "true")
      return { status: 503, data: { success: false, message: "Referral accounting disabled" } };
    if (type === "refund.processed" && env.ENABLE_STAGING_REFERRALS !== "true")
      return { status: 503, data: { success: false, message: "Refund accounting disabled" } };
    const now = new Date();
    const claim = await events.findOneAndUpdate(
      { eventId, $or: [{ status: "failed" }, { status: "processing", lockedUntil: { $lte: now } }] },
      { $set: { status: "processing", lockedUntil: new Date(now.getTime() + 120000),
        eventType: type, lastError: null }, $inc: { attempts: 1 } }, { returnDocument: "after" });
    if (!claim) {
      const existing = await events.findOne({ eventId });
      if (existing?.status === "processed") return { status: 200, data: { success: true, duplicate: true } };
      if (existing) return { status: 503, data: { success: false, message: "Event processing; retry" } };
      try {
        await events.insertOne({ eventId, eventType: type, status: "processing",
          attempts: 1, lockedUntil: new Date(now.getTime() + 120000), createdAt: now });
      } catch (e) {
        if (e.code === 11000) return { status: 503, data: { success: false, message: "Concurrent event; retry" } };
        throw e;
      }
    }
    claimed = true;
    // Transaction commits payment, subscription, commission/refund and webhook ack together.
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        if (type === "refund.processed") {
          if (!refund?.id || !refund.payment_id || !Number.isFinite(refund.amount) || refund.amount <= 0)
            throw new Error("INVALID_REFUND");
          // Verify refund belongs to the configured Razorpay Test Mode account.
          const verifiedRefund = await razorpayApi(env, "GET", "refunds/" + encodeURIComponent(refund.id), { fetchImpl });
          if (verifiedRefund?.id !== refund.id || verifiedRefund.payment_id !== refund.payment_id ||
              verifiedRefund.amount !== refund.amount || verifiedRefund.status !== "processed")
            throw new Error("REFUND_VERIFICATION_MISMATCH");
          await reverseRefund(db, session, verifiedRefund);
        }
        if (user) {
          const update = subscriptionUpdate(type, subscription || { id: subscriptionId });
          if (Object.keys(update).length) await users.updateOne({ _id: user._id }, { $set: update }, { session });
          if (captured || type === "payment.failed") {
            const p = captured?.payment || payment;
            if (p?.id && Number.isFinite(p.amount) && p.amount >= 0) {
              await db.collection("payments").updateOne({ razorpayPaymentId: p.id },
                { $setOnInsert: { userId: user._id, razorpayPaymentId: p.id,
                  razorpaySubscriptionId: subscriptionId, amount: p.amount / 100,
                  currency: p.currency || "INR", status: captured ? "captured" : "failed",
                  eventType: type, paidAt: captured ? dateFromEpoch(p.created_at) : null,
                  createdAt: now, updatedAt: now } }, { upsert: true, session });
            }
          }
          if (type === "subscription.charged") await recordCommission(db, session, user, captured.payment);
        }
        await events.updateOne({ eventId, status: "processing" },
          { $set: { status: "processed", processedAt: new Date(), lockedUntil: null } }, { session });
      });
    } finally { await session.endSession(); }
    return { status: 200, data: { success: true } };
  } catch (error) {
    if (claimed) await client.db(dbName).collection("webhookevents").updateOne(
      { eventId, status: "processing" }, { $set: { status: "failed",
        lockedUntil: null, lastError: String(error.message || error).slice(0, 200) } }).catch(() => {});
    return { status: 503, data: { success: false, message: "Webhook processing failed" } };
  } finally { await client.close(); }
}
