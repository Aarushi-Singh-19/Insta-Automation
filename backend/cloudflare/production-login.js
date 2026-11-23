import bcrypt from "bcryptjs";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { issueStagingJwt } from "./staging-login.js";

// Production native login. Never accepts staging DB credentials or staging JWT secrets.
export async function loginProductionUser({ env, MongoClient, email, password }) {
  let client;
  let stage = "configuration";
  try {
    const { uri, dbName } = validateProductionMongoConfig(env);
    if (env?.ENABLE_PRODUCTION_AUTH !== "true") throw new Error("PRODUCTION_AUTH_DISABLED");
    stage = "jwt_configuration";
    if (typeof env.PRODUCTION_JWT_SECRET !== "string" || env.PRODUCTION_JWT_SECRET.length < 32 ||
        env.PRODUCTION_JWT_SECRET === env.STAGING_JWT_SECRET) throw new Error("PRODUCTION_JWT_SECRET_REQUIRED");
    if (typeof email !== "string" || typeof password !== "string" ||
        !email.trim() || !password || email.length > 320 || password.length > 1024)
      return { status: 400, body: { message: "Invalid credentials" } };
    stage = "mongo_client";
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    stage = "mongo_connect";
    await client.connect();
    stage = "user_lookup";
    const user = await client.db(dbName).collection("users").findOne({ email: email.trim().toLowerCase() });
    stage = "password_verification";
    if (!user || typeof user.password !== "string" || !await bcrypt.compare(password, user.password))
      return { status: 400, body: { message: "Invalid credentials" } };
    stage = "session_signing";
    const token = await issueStagingJwt(String(user._id), env.PRODUCTION_JWT_SECRET);
    stage = "response";
    const { password: ignored, accessToken, passwordResetTokenHash, passwordResetExpires,
      razorpaySubscriptionId, razorpayCustomerId, cloudflareSubscriptionCreation,
      cloudflareBillingCheckedAt, passwordResetRequestedAt, ...safe } = user;
    const sanitized = { ...safe, _id: String(user._id) };
    const now = Date.now();
    if (sanitized.subscriptionStatus === "active" &&
        (!sanitized.planEndDate || new Date(sanitized.planEndDate).getTime() <= now))
      sanitized.subscriptionStatus = "expired";
    if (sanitized.subscriptionStatus === "trial" && sanitized.trialEndDate &&
        new Date(sanitized.trialEndDate).getTime() <= now)
      sanitized.subscriptionStatus = "expired";
    return { status: 200, body: { token, user: sanitized } };
  } catch (error) {
    const codes = [13, 18, 8000];
    const mongoCode = codes.includes(error?.code) ? error.code : null;
    console.error("Production login failed", { stage, mongoCode });
    throw error;
  } finally {
    if (client) {
      await client.close().catch(() => {
        console.error("Production login failed", { stage: "mongo_close" });
      });
    }
  }
}
