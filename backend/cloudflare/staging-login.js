import { validateStagingMongoConfig } from "./staging-mongodb.js";
import bcrypt from "bcryptjs";

const enc = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const encodeJson = obj => base64url(enc.encode(JSON.stringify(obj)));

export async function issueStagingJwt(userId, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 16) throw new Error("JWT_SECRET_NOT_CONFIGURED");
  if (typeof userId !== "string" || !/^[a-f0-9]{24}$/i.test(userId)) throw new Error("INVALID_USER_ID");
  const input = encodeJson({ alg: "HS256", typ: "JWT" }) + "." +
    encodeJson({ id: userId, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 7 * 86400 });
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return input + "." + base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(input))));
}

export async function loginStagingUser({ env, MongoClient, email, password }) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { status: 400, body: { message: "Email and password required" } };
  }
  if (email.length > 320 || password.length > 1024) return { status: 400, body: { message: "Invalid credentials" } };
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const user = await client.db(dbName).collection("users").findOne({ email: email.trim().toLowerCase() });
    if (!user || typeof user.password !== "string" || !await bcrypt.compare(password, user.password)) {
      return { status: 400, body: { message: "Invalid credentials" } };
    }
    const token = await issueStagingJwt(String(user._id), env.STAGING_JWT_SECRET);
    const { password: ignoredPassword, accessToken, passwordResetTokenHash, passwordResetExpires,
      razorpaySubscriptionId, razorpayCustomerId, ...safeUser } = user;
    const sanitized = { ...safeUser, _id: String(user._id) };
    const now = Date.now();
    if (sanitized.subscriptionStatus === "active" &&
        (!sanitized.planEndDate || new Date(sanitized.planEndDate).getTime() <= now)) sanitized.subscriptionStatus = "expired";
    if (sanitized.subscriptionStatus === "trial" && sanitized.trialEndDate &&
        new Date(sanitized.trialEndDate).getTime() <= now) sanitized.subscriptionStatus = "expired";
    return { status: 200, body: { token, user: sanitized } };
  } finally { await client.close(); }
}
