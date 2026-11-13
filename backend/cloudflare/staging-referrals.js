import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

const oid = id => /^[0-9a-f]{24}$/i.test(String(id || "")) ? new ObjectId(String(id)) : null;
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const failure = (status, message) => ({ status, data: { success: false, message } });
const success = (data, status = 200) => ({ status, data: { success: true, ...data } });
export function referralConfig(env) {
  if (env?.ENABLE_STAGING_REFERRALS !== "true") throw new Error("REFERRALS_DISABLED");
  return validateStagingMongoConfig(env);
}
export async function withReferralDb({ env, MongoClient }, fn) {
  const { uri, dbName } = referralConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 3 });
  try { await client.connect(); return await fn(client.db(dbName), client); }
  finally { await client.close(); }
}
export async function referralSummary({ env, MongoClient, userId }) {
  return withReferralDb({ env, MongoClient }, async db => {
    const id = oid(userId);
    if (!id) return failure(401, "Unauthorized");
    const users = db.collection("users");
    let user = await users.findOne({ _id: id }, { projection: { referralCode: 1 } });
    if (!user) return failure(404, "User not found");
    if (!user.referralCode) {
      for (let i = 0; i < 5; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(5));
        const code = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        try {
          await users.updateOne({ _id: id, $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: "" }] }, { $set: { referralCode: code } });
          user = await users.findOne({ _id: id }, { projection: { referralCode: 1 } });
          if (user?.referralCode) break;
        } catch (e) { if (e.code !== 11000) throw e; }
      }
    }
    if (!user?.referralCode) return failure(503, "Referral code unavailable");
    const [referrals, earnings] = await Promise.all([
      users.find({ referredBy: id }, { projection: { name: 1, createdAt: 1, subscriptionStatus: 1, currentPlan: 1 } }).sort({ createdAt: -1 }).toArray(),
      db.collection("referralearnings").find({ referrerId: id }).sort({ createdAt: -1 }).toArray()
    ]);
    const sum = states => round(earnings.filter(e => states.includes(e.status)).reduce((n,e) => n + Number(e.commissionAmount || 0),0));
    const eligibleBalance = sum(["eligible"]);
    return success({ referralCode: user.referralCode, referralLink: "https://triggerdm.in/signup?ref=" + encodeURIComponent(user.referralCode),
      commissionRate: 20, subscriptionPrice: 199, commissionPerPayment: 39.8, minimumPayout: 199,
      totalReferrals: referrals.length, payingReferrals: referrals.filter(u => u.subscriptionStatus === "active").length,
      totalEarned: sum(["paid"]), eligibleBalance, pendingBalance: sum(["requested"]),
      canRequestPayout: eligibleBalance >= 199,
      referrals: referrals.map(u => ({ id: u._id, name: u.name || "TriggerDM user", joinedAt: u.createdAt, subscriptionStatus: u.subscriptionStatus, currentPlan: u.currentPlan })),
      earnings: earnings.map(e => ({ id: e._id, grossAmount: e.grossAmount, commissionAmount: e.commissionAmount, status: e.status, createdAt: e.createdAt, paidAt: e.paidAt })) });
  });
}
export async function payoutRequests({ env, MongoClient, userId, method, body, admin = false, payoutId = null }) {
  return withReferralDb({ env, MongoClient }, async (db, client) => {
    const id = oid(userId);
    if (!id) return failure(401, "Unauthorized");
    const requests = db.collection("referralpayoutrequests");
    const earnings = db.collection("referralearnings");
    if (admin) {
      const actor = await db.collection("users").findOne({ _id: id }, { projection: { email: 1 } });
      if (!env.ADMIN_EMAIL || String(actor?.email || "").trim().toLowerCase() !== String(env.ADMIN_EMAIL).trim().toLowerCase()) return failure(403, "Forbidden");
    }
    if (method === "GET") {
      const docs = await requests.find(admin ? {} : { referrerId: id }).sort({ requestedAt: -1 }).toArray();
      if (admin) {
        const owners = await db.collection("users").find({ _id: { $in: docs.map(d => d.referrerId) } }, { projection: { name: 1, email: 1 } }).toArray();
        const byId = new Map(owners.map(u => [String(u._id), u]));
        return success({ requests: docs.map(d => ({ ...d, referrerId: byId.get(String(d.referrerId)) || d.referrerId })) });
      }
      return success({ requests: docs });
    }
    const session = client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        if (!admin && method === "POST") {
          const available = await earnings.find({ referrerId: id, status: "eligible", commissionAmount: { $gt: 0 } }, { session }).toArray();
          const amount = round(available.reduce((n,e) => n + e.commissionAmount, 0));
          if (amount < 199) { result = failure(400, "You need at least ₹199 in eligible earnings to request a payout."); return; }
          const earningIds = available.map(e => e._id);
          const reserved = await earnings.updateMany({ _id: { $in: earningIds }, referrerId: id, status: "eligible", commissionAmount: { $gt: 0 } }, { $set: { status: "requested", updatedAt: new Date() } }, { session });
          if (reserved.modifiedCount !== earningIds.length) throw new Error("RESERVATION_CONFLICT");
          const doc = { _id: new ObjectId(), referrerId: id, earningIds, amount, currency: "INR", status: "requested", requestedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
          await requests.insertOne(doc, { session });
          result = success({ request: doc }, 201);
          return;
        }
        if (!admin || method !== "PATCH" || !oid(payoutId)) { result = failure(400, "Invalid request"); return; }
        const payout = await requests.findOne({ _id: oid(payoutId) }, { session });
        if (!payout) { result = failure(404, "Payout request not found"); return; }
        const action = body?.action;
        if (!["approve", "reject", "paid"].includes(action)) { result = failure(400, "Invalid action"); return; }
        if ((action === "approve" && payout.status !== "requested") ||
            (action === "reject" && !["requested", "approved"].includes(payout.status)) ||
            (action === "paid" && payout.status !== "approved")) { result = failure(409, "Invalid payout status transition"); return; }
        const now = new Date();
        const changes = { updatedAt: now, reviewedAt: now, reviewedBy: id };
        if (action === "approve") changes.status = "approved";
        if (action === "reject") {
          changes.status = "rejected";
          changes.adminNote = typeof body?.note === "string" ? body.note.trim().slice(0,500) : null;
          await earnings.updateMany({ _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested" }, { $set: { status: "eligible", updatedAt: now } }, { session });
        }
        if (action === "paid") {
          const reference = String(body?.transferReference || "").trim().slice(0,160);
          if (!reference) { result = failure(400, "Confirmed transfer reference required"); return; }
          const reserved = await earnings.find({ _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested" }, { session }).toArray();
          if (reserved.length !== payout.earningIds.length || round(reserved.reduce((n,e) => n + e.commissionAmount,0)) !== payout.amount) {
            result = failure(409, "Reserved earnings changed; reconcile before paying"); return;
          }
          const marked = await earnings.updateMany({ _id: { $in: payout.earningIds }, referrerId: payout.referrerId, status: "requested" }, { $set: { status: "paid", paidAt: now, updatedAt: now } }, { session });
          if (marked.modifiedCount !== payout.earningIds.length) throw new Error("PAYOUT_CONFLICT");
          Object.assign(changes, { status: "paid", completedAt: now, transferReference: reference });
        }
        await requests.updateOne({ _id: payout._id, status: payout.status }, { $set: changes }, { session });
        result = success({ request: { ...payout, ...changes } });
      });
      return result;
    } catch { return failure(503, "Payout operation could not be completed safely"); }
    finally { await session.endSession(); }
  });
}
export async function recordCommission(db, session, user, payment) {
  if (!user?.referredBy) return;
  if (!payment?.id || payment.status !== "captured" || payment.currency !== "INR" || payment.amount !== 19900) return;
  const earnings = db.collection("referralearnings");
  const referrerId = oid(user.referredBy);
  if (!referrerId) throw new Error("INVALID_REFERRER");
  const now = new Date();
  const doc = { _id: new ObjectId(), referrerId, referredUserId: user._id, razorpayPaymentId: payment.id,
    grossAmount: 199, commissionRate: 20, commissionAmount: 39.8, originalCommissionAmount: 39.8,
    recoveryApplied: 0, recoveryAppliedReversedAmount: 0, refundedAmount: 0, commissionReversedAmount: 0,
    recoveryDue: 0, currency: "INR", status: "eligible", createdAt: now, updatedAt: now };
  const inserted = await earnings.updateOne({ razorpayPaymentId: payment.id }, { $setOnInsert: doc }, { upsert: true, session });
  if (!inserted.upsertedCount) return;
  let remaining = doc.commissionAmount, applied = 0;
  const sources = await earnings.find({ referrerId, _id: { $ne: doc._id }, recoveryDue: { $gt: 0 } }, { session }).sort({ createdAt: 1, _id: 1 }).toArray();
  for (const source of sources) {
    if (remaining <= 0) break;
    const offset = round(Math.min(remaining, source.recoveryDue));
    const updated = await earnings.updateOne({ _id: source._id, recoveryDue: source.recoveryDue }, { $inc: { recoveryDue: -offset }, $set: { updatedAt: now } }, { session });
    if (updated.modifiedCount !== 1) throw new Error("RECOVERY_CONFLICT");
    remaining = round(remaining - offset); applied = round(applied + offset);
  }
  await earnings.updateOne({ _id: doc._id }, { $set: { commissionAmount: remaining, recoveryApplied: applied, updatedAt: now } }, { session });
}
export async function reverseRefund(db, session, refund) {
  if (!refund?.id || !refund.payment_id || !Number.isFinite(refund.amount) || refund.amount <= 0) throw new Error("INVALID_REFUND");
  const records = db.collection("referralrefundrecords");
  if (await records.findOne({ razorpayRefundId: refund.id }, { session })) return;
  const earnings = db.collection("referralearnings");
  const earning = await earnings.findOne({ razorpayPaymentId: refund.payment_id }, { session });
  if (!earning) {
    // Non-referral payment refunds have no commission to reverse.
    const payment = await db.collection("payments").findOne({ razorpayPaymentId: refund.payment_id }, { session });
    if (!payment) throw new Error("REFUND_PAYMENT_UNKNOWN");
    await records.insertOne({ razorpayRefundId: refund.id, razorpayPaymentId: refund.payment_id, amount: refund.amount / 100, commissionReversal: 0, processedAt: new Date() }, { session });
    return;
  }
  const gross = Number(earning.grossAmount), original = Number(earning.originalCommissionAmount ?? earning.commissionAmount);
  if (!(gross > 0) || !(original >= 0)) throw new Error("INVALID_EARNING");
  const refunded = Math.min(gross, round(Number(earning.refundedAmount || 0) + refund.amount / 100));
  const target = Math.min(original, round(refunded / gross * original));
  const delta = Math.max(0, round(target - Number(earning.commissionReversedAmount || 0)));
  const applied = Number(earning.recoveryApplied || 0);
  const restore = Math.min(applied, round(refunded / gross * applied));
  const restoreDelta = Math.max(0, round(restore - Number(earning.recoveryAppliedReversedAmount || 0)));
  const updates = { refundedAmount: refunded, commissionReversedAmount: target, recoveryAppliedReversedAmount: restore, updatedAt: new Date() };
  if (earning.status === "paid") updates.recoveryDue = round(Number(earning.recoveryDue || 0) + delta);
  else {
    updates.recoveryDue = round(Number(earning.recoveryDue || 0) + restoreDelta);
    updates.commissionAmount = Math.max(0, round(original - target - Math.max(0, applied - restore)));
    if (!updates.commissionAmount) updates.status = "reversed";
  }
  await records.insertOne({ razorpayRefundId: refund.id, razorpayPaymentId: refund.payment_id, amount: refund.amount / 100, commissionReversal: delta, processedAt: new Date() }, { session });
  await earnings.updateOne({ _id: earning._id }, { $set: updates }, { session });
}
