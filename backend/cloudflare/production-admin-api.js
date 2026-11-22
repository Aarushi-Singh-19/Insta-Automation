import { ObjectId } from "mongodb";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { cors } from "./upstream-proxy.js";

const projection = { name: 1, email: 1, subscriptionStatus: 1, currentPlan: 1,
  createdAt: 1, trialStartDate: 1, trialEndDate: 1, planEndDate: 1 };
const statuses = ["trial", "active", "expired", "past_due", "cancelled", "halted"];

function userFilter(params) {
  const filter = {};
  const status = params.get("status");
  if (statuses.includes(status)) filter.subscriptionStatus = status;
  const search = params.get("search")?.trim().slice(0, 120);
  if (search) {
    const term = new RegExp(search.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: term }, { email: term }];
  }
  const dateRange = {};
  for (const [key, op, time] of [["from", "$gte", "00:00:00.000"], ["to", "$lte", "23:59:59.999"]]) {
    const value = params.get(key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) continue;
    const date = new Date(value + "T" + time + "Z");
    if (Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)) dateRange[op] = date;
  }
  if (Object.keys(dateRange).length) filter.createdAt = dateRange;
  return filter;
}

async function adminOverview({ users, accounts, payments }) {
  const now = new Date();
  const filters = [
    {}, { subscriptionStatus: "trial", trialEndDate: { $gt: now } },
    { $or: [{ subscriptionStatus: "expired" }, { subscriptionStatus: "trial", trialEndDate: { $lte: now } }] },
    { subscriptionStatus: "active", planEndDate: { $gt: now } },
    { subscriptionStatus: "past_due" }, { subscriptionStatus: "cancelled" }, { subscriptionStatus: "halted" },
  ];
  const [counts, connected, recent, revenue] = await Promise.all([
    Promise.all(filters.map(filter => users.countDocuments(filter))),
    accounts.distinct("userId", { status: "active" }),
    users.find({}, { projection }).sort({ createdAt: -1 }).limit(10).toArray(),
    payments.aggregate([{ $match: { status: "captured" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).toArray(),
  ]);
  const [totalUsers, activeTrials, expiredTrials, activePaidSubscribers,
    pastDueSubscribers, cancelledSubscribers, haltedSubscribers] = counts;
  const ids = new Set(connected.map(String));
  return { generatedAt: now.toISOString(), metrics: { totalUsers, activeTrials, expiredTrials,
    activePaidSubscribers, pastDueSubscribers, cancelledSubscribers, haltedSubscribers,
    instagramConnected: ids.size, capturedPayments: revenue[0]?.count || 0,
    capturedRevenuePaise: revenue[0]?.total || 0 },
  recentUsers: recent.map(user => ({ ...user, instagramConnected: ids.has(String(user._id)) })) };
}

export async function handleProductionAdminApi({ request, env, MongoClient }) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return null;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/)/, "");
  if (!["/admin/overview", "/admin/users", "/health"].includes(path)) return null;
  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: allowed["Access-Control-Allow-Origin"] ? 204 : 403, headers });
  if (request.method !== "GET") return json({ message: "Method not allowed" }, 405);
  if (path === "/health") return json({ success: true, message: "Health API is working" }, 200);
  const secret = env.PRODUCTION_JWT_SECRET;
  const adminEmail = env.PRODUCTION_ADMIN_EMAIL?.trim().toLowerCase();
  if (env.ENABLE_PRODUCTION_AUTH !== "true" || env.ENABLE_PRODUCTION_CUSTOMER_API !== "true" ||
      typeof secret !== "string" || secret.length < 32 || secret === env.STAGING_JWT_SECRET || !adminEmail)
    return json({ message: "Service unavailable" }, 503);
  let userId;
  try {
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("Authorization") || "")?.[1];
    userId = getTriggerDmUserId(await verifySessionJwt(token, secret));
  } catch {
    return json({ message: "Unauthorized" }, 401);
  }
  let client;
  try {
    const { uri, dbName } = validateProductionMongoConfig(env);
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 3 });
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");
    const actor = await users.findOne({ _id: new ObjectId(userId) }, { projection: { email: 1 } });
    if (actor?.email?.trim().toLowerCase() !== adminEmail) return json({ message: "Forbidden" }, 403);
    const accounts = db.collection("instagramaccounts");
    if (path === "/admin/overview") return json(await adminOverview({ users, accounts, payments: db.collection("payments") }), 200);
    const page = Math.min(10000, Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1));
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit"), 10) || 25));
    const filter = userFilter(url.searchParams);
    const [total, records] = await Promise.all([
      users.countDocuments(filter),
      users.find(filter, { projection }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    ]);
    const ids = await accounts.distinct("userId", { userId: { $in: records.map(user => user._id) }, status: "active" });
    const connected = new Set(ids.map(String));
    return json({ users: records.map(user => ({ ...user, instagramConnected: connected.has(String(user._id)) })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 200);
  } catch {
    return json({ message: "Service unavailable" }, 503);
  } finally {
    if (client) await client.close();
  }
}
