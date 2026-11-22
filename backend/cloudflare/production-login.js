import bcrypt from "bcryptjs";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { issueStagingJwt } from "./staging-login.js";

// Production native login. Never accepts staging DB credentials or staging JWT secrets.
export async function loginProductionUser({ env, MongoClient, email, password }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  if (env?.ENABLE_PRODUCTION_AUTH !== "true") throw new Error("PRODUCTION_AUTH_DISABLED");
  if (typeof env.PRODUCTION_JWT_SECRET !== "string" || env.PRODUCTION_JWT_SECRET.length < 32 ||
      env.PRODUCTION_JWT_SECRET === env.STAGING_JWT_SECRET) throw new Error("PRODUCTION_JWT_SECRET_REQUIRED");
  if (typeof email !== "string" || typeof password !== "string" ||
      !email.trim() || !password || email.length > 320 || password.length > 1024)
    return { status: 400, body: { message: "Invalid credentials" } };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const user = await client.db(dbName).collection("users").findOne({ email: email.trim().toLowerCase() });
    if (!user || typeof user.password !== "string" || !await bcrypt.compare(password, user.password))
      return { status: 400, body: { message: "Invalid credentials" } };
    const token = await issueStagingJwt(String(user._id), env.PRODUCTION_JWT_SECRET);
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
  } finally { await client.close(); }
}
