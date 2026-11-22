import bcrypt from "bcryptjs";
import { validateProductionMongoConfig } from "./production-mongodb.js";
import { signupStagingUser } from "./staging-signup.js";
import { cors } from "./upstream-proxy.js";

const encoder = new TextEncoder();
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
const hashToken = async token => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
const resetMessage = "If an account exists for that email, a password reset link will be sent.";

async function sendEmail({ env, fetchImpl, to, subject, text }) {
  if (!env.PRODUCTION_RESEND_API_KEY || !env.PRODUCTION_EMAIL_FROM) return false;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.PRODUCTION_RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.PRODUCTION_EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function updatePassword({ path, input, env, MongoClient, fetchImpl }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  const forgot = path === "/auth/forgot-password";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const { token, password } = input ?? {};
  if (forgot && (!email || email.length > 320)) return { status: 400, message: "Email is required" };
  if (!forgot && (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== "string" || password.length < 8 || encoder.encode(password).length > 72)) {
    return { status: 400, message: "A valid reset token and a password of at least 8 characters are required." };
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const users = client.db(dbName).collection("users");
    if (!forgot) {
      const tokenHash = await hashToken(token);
      const result = await users.updateOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } },
        { $set: { password: await bcrypt.hash(password, 10), updatedAt: new Date() },
          $unset: { passwordResetTokenHash: "", passwordResetExpires: "" } });
      return result.modifiedCount === 1
        ? { status: 200, message: "Password updated successfully. You can now log in." }
        : { status: 400, message: "This reset link is invalid or has expired. Request a new one." };
    }
    const rawToken = hex(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await hashToken(rawToken);
    const now = new Date();
    const claim = await users.updateOne({ email, $or: [
      { passwordResetRequestedAt: { $exists: false } },
      { passwordResetRequestedAt: { $lte: new Date(now.getTime() - 60000) } },
    ] }, { $set: { passwordResetTokenHash: tokenHash,
      passwordResetExpires: new Date(now.getTime() + 30 * 60000), passwordResetRequestedAt: now } });
    if (claim.modifiedCount === 1) {
      const sent = await sendEmail({ env, fetchImpl, to: email, subject: "Reset your TriggerDM password",
        text: "This link expires in 30 minutes and can be used once.\n\nhttps://triggerdm.in/reset-password?token=" + rawToken });
      if (!sent) await users.updateOne({ email, passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: "", passwordResetExpires: "" } });
    }
    return { status: 200, message: resetMessage };
  } finally {
    await client.close();
  }
}

export async function handleProductionAuthActions({ request, env, MongoClient, ctx, fetchImpl = fetch }) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return null;
  const path = new URL(request.url).pathname.replace(/^\/api(?=\/)/, "");
  if (!["/auth/signup", "/auth/forgot-password", "/auth/reset-password"].includes(path)) return null;
  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { headers, status: allowed["Access-Control-Allow-Origin"] ? 204 : 403 });
  if (request.method !== "POST") return json({ message: "Method not allowed" }, 405);
  if (env.ENABLE_PRODUCTION_AUTH !== "true" || env.ENABLE_PRODUCTION_AUTH_ACTIONS !== "true")
    return json({ message: "Service unavailable" }, 503);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ message: "Payload too large" }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ message: "Invalid request body" }, 400);
  }
  try {
    if (path === "/auth/signup") {
      if (typeof input?.password === "string" && encoder.encode(input.password).length > 72)
        return json({ message: "Invalid signup details" }, 400);
      const result = await signupStagingUser({ env, MongoClient, name: input?.name, email: input?.email,
        password: input?.password, referralCode: input?.referralCode });
      if (result.status === 201) {
        const delivered = sendEmail({ env, fetchImpl, to: result.body.user.email, subject: "Welcome to TriggerDM",
          text: "Your 7-day trial has started. Open your dashboard at https://triggerdm.in/dashboard" });
        if (ctx?.waitUntil) ctx.waitUntil(delivered);
        else await delivered;
      }
      return json(result.body, result.status);
    }
    if (path === "/auth/forgot-password" && (!env.PRODUCTION_RESEND_API_KEY || !env.PRODUCTION_EMAIL_FROM))
      return json({ message: "Service unavailable" }, 503);
    const result = await updatePassword({ path, input, env, MongoClient, fetchImpl });
    return json({ message: result.message }, result.status);
  } catch {
    return json({ message: "Service unavailable" }, 503);
  }
}
