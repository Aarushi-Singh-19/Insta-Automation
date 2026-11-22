import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { cors } from "./upstream-proxy.js";
import {
  createStagingSubscription, stagingPaymentHistory, reconcileStagingSubscription,
  processStagingRazorpayWebhook, recoverStagingBilling,
} from "./staging-razorpay.js";
import { referralSummary, payoutRequests } from "./staging-referrals.js";

function financialEnv(env) {
  return {
    ...env,
    RAZORPAY_KEY_ID: env.PRODUCTION_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: env.PRODUCTION_RAZORPAY_KEY_SECRET,
    RAZORPAY_MONTHLY_PLAN_ID: env.PRODUCTION_RAZORPAY_MONTHLY_PLAN_ID,
    RAZORPAY_WEBHOOK_SECRET: env.PRODUCTION_RAZORPAY_WEBHOOK_SECRET,
    ADMIN_EMAIL: env.PRODUCTION_ADMIN_EMAIL,
  };
}

export function recoverProductionBilling({ env, MongoClient }) {
  return recoverStagingBilling({ env: financialEnv(env), MongoClient });
}

export async function handleProductionFinancialApi({ request, env, MongoClient, fetchImpl = fetch }) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return null;
  const path = new URL(request.url).pathname.replace(/^\/api(?=\/)/, "");
  const routes = {
    "/billing/create-subscription": ["POST", createStagingSubscription],
    "/billing/history": ["GET", async args => ({ status: 200, data: await stagingPaymentHistory(args) })],
    "/billing/reconcile": ["POST", reconcileStagingSubscription],
    "/billing/razorpay-webhook": ["POST", processStagingRazorpayWebhook],
    "/referrals/summary": ["GET", referralSummary],
    "/referrals/payouts/requests": ["GET POST", payoutRequests],
    "/referrals/payouts/admin/requests": ["GET", payoutRequests],
  };
  const payoutId = /^\/referrals\/payouts\/admin\/requests\/([a-f0-9]{24})$/i.exec(path)?.[1];
  const route = payoutId ? ["PATCH", payoutRequests] : routes[path];
  if (!route) return null;
  const [methods, handle] = route;
  const method = request.method;
  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  const webhook = handle === processStagingRazorpayWebhook;
  if (method === "OPTIONS" && !webhook) {
    return new Response(null, { status: allowed["Access-Control-Allow-Origin"] ? 204 : 403, headers });
  }
  if (!methods.split(" ").includes(method)) return json({ message: "Method not allowed" }, 405);

  let userId;
  if (!webhook) {
    const secret = env.PRODUCTION_JWT_SECRET;
    if (env.ENABLE_PRODUCTION_AUTH !== "true" || typeof secret !== "string" ||
        secret.length < 32 || secret === env.STAGING_JWT_SECRET) return json({ message: "Service unavailable" }, 503);
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("Authorization") || "")?.[1];
    try {
      userId = getTriggerDmUserId(await verifySessionJwt(token, secret));
    } catch {
      return json({ message: "Unauthorized" }, 401);
    }
  }
  let body;
  if (method === "PATCH") {
    const raw = await request.text();
    if (raw.length > 4096) return json({ message: "Payload too large" }, 413);
    try { body = JSON.parse(raw); }
    catch { return json({ message: "Invalid request body" }, 400); }
  }
  try {
    const result = await handle({ env: financialEnv(env), MongoClient, fetchImpl, request, userId,
      method, body, admin: path.includes("/admin/"), payoutId });
    return json(result.data, result.status);
  } catch {
    return json({ success: false, message: "Financial service unavailable" }, 503);
  }
}
