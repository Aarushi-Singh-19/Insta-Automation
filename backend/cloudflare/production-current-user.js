import { ObjectId } from "mongodb";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";

export async function getProductionCurrentUser({ env, MongoClient, authorization }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  if (env?.ENABLE_PRODUCTION_AUTH !== "true") throw new Error("PRODUCTION_AUTH_DISABLED");
  if (typeof env.PRODUCTION_JWT_SECRET !== "string" || env.PRODUCTION_JWT_SECRET.length < 32 ||
      env.PRODUCTION_JWT_SECRET === env.STAGING_JWT_SECRET) throw new Error("PRODUCTION_JWT_SECRET_REQUIRED");
  const token = /^Bearer ([^\s]+)$/.exec(String(authorization || ""))?.[1];
  if (!token) return { status: 401, body: { message: "Unauthorized" } };
  let userId;
  try { userId = getTriggerDmUserId(await verifySessionJwt(token, env.PRODUCTION_JWT_SECRET)); }
  catch { return { status: 401, body: { message: "Unauthorized" } }; }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const user = await client.db(dbName).collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, accessToken: 0, passwordResetTokenHash: 0,
        passwordResetExpires: 0, passwordResetRequestedAt: 0, razorpaySubscriptionId: 0,
        razorpayCustomerId: 0, cloudflareSubscriptionCreation: 0, cloudflareBillingCheckedAt: 0 } });
    if (!user) return { status: 401, body: { message: "Unauthorized" } };
    const now = Date.now(), safe = { ...user, _id: String(user._id) };
    if (safe.subscriptionStatus === "active" &&
        (!safe.planEndDate || new Date(safe.planEndDate).getTime() <= now)) safe.subscriptionStatus = "expired";
    if (safe.subscriptionStatus === "trial" && safe.trialEndDate &&
        new Date(safe.trialEndDate).getTime() <= now) safe.subscriptionStatus = "expired";
    return { status: 200, body: { user: safe } };
  } finally { await client.close(); }
}
