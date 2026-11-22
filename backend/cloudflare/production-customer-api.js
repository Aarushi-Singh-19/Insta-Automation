import { ObjectId } from "mongodb";
import { validateNativeServiceMongoConfig } from "./native-service-mongodb.js";
import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { nativeStagingCampaigns } from "./staging-campaign-crud.js";
import { stagingAnalytics } from "./staging-analytics.js";
import { stagingAutomations } from "./staging-automations.js";
import { listStagingInstagramAccounts } from "./staging-instagram-accounts.js";
import { listStagingInstagramMedia } from "./staging-instagram-media.js";
import { listStagingRules } from "./staging-rules.js";
import { createStagingRule } from "./staging-rule-create.js";
import { updateStagingRule } from "./staging-rule-update.js";
import { deleteStagingRule } from "./staging-rule-delete.js";
import { toggleStagingRule } from "./staging-rule-toggle.js";
import { cors } from "./upstream-proxy.js";

const routes = [
  [/^\/campaigns(?:\/([a-f0-9]{24})(?:\/(rules))?)?$/i, ["GET", "POST", "PUT", "PATCH", "DELETE"],
    (args, match) => nativeStagingCampaigns({ ...args, campaignId: match[1], action: match[2] })],
  [/^\/analytics\/(dashboard|trends)$/, ["GET"],
    async (args, match) => ({ body: await stagingAnalytics({ ...args, kind: match[1] }) })],
  [/^\/automations$/, ["GET", "POST"], stagingAutomations],
  [/^\/automations\/([a-f0-9]{24})$/i, ["PUT", "DELETE"],
    (args, match) => stagingAutomations({ ...args, automationId: match[1] })],
  [/^\/instagram\/accounts$/, ["GET"],
    async args => ({ body: { success: true, data: await listStagingInstagramAccounts(args) } })],
  [/^\/instagram\/media$/, ["GET"],
    (args, match, url) => listStagingInstagramMedia({ ...args, search: url.searchParams.get("search") || "" })],
  [/^\/rules$/, ["GET", "POST"], async args => args.method === "POST" ? createStagingRule(args) :
    { body: { success: true, data: await listStagingRules(args) } }],
  [/^\/rules\/([a-f0-9]{24})$/i, ["PATCH", "DELETE"],
    (args, match) => (args.method === "PATCH" ? updateStagingRule : deleteStagingRule)({ ...args, ruleId: match[1] })],
  [/^\/rules\/([a-f0-9]{24})\/toggle$/i, ["PATCH"],
    (args, match) => toggleStagingRule({ ...args, ruleId: match[1] })],
];

async function customerAccess({ MongoClient, uri, dbName, authenticatedUserId }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const user = await client.db(dbName).collection("users").findOne(
      { _id: new ObjectId(authenticatedUserId) },
      { projection: { subscriptionStatus: 1, trialEndDate: 1, planEndDate: 1 } }
    );
    if (!user) return 404;
    const expiresAt = user.subscriptionStatus === "trial" ? user.trialEndDate :
      ["active", "cancelled"].includes(user.subscriptionStatus) ? user.planEndDate : null;
    return expiresAt && new Date(expiresAt).getTime() > Date.now() ? 200 : 403;
  } finally {
    await client.close();
  }
}

export async function handleProductionCustomerApi({ request, env, MongoClient }) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return null;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/)/, "");
  const route = routes.find(([pattern]) => pattern.test(path));
  if (!route) return null;
  const [pattern, methods, handle] = route;
  const method = request.method;
  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  if (method === "OPTIONS") return new Response(null, { status: allowed["Access-Control-Allow-Origin"] ? 204 : 403, headers });
  if (!methods.includes(method)) return json({ message: "Method not allowed" }, 405);

  try {
    const db = validateNativeServiceMongoConfig(env);
    const secret = env.PRODUCTION_JWT_SECRET;
    if (env.ENABLE_PRODUCTION_AUTH !== "true" || typeof secret !== "string" ||
        secret.length < 32 || secret === env.STAGING_JWT_SECRET) throw new Error("PRODUCTION_AUTH_UNAVAILABLE");
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("Authorization") || "")?.[1];
    let authenticatedUserId;
    try {
      authenticatedUserId = getTriggerDmUserId(await verifySessionJwt(token, secret));
    } catch {
      return json({ message: "Unauthorized" }, 401);
    }

    let input;
    if (["POST", "PUT", "PATCH"].includes(method) && !path.endsWith("/toggle")) {
      if (Number(request.headers.get("Content-Length")) > 16384) return json({ message: "Payload too large" }, 413);
      try {
        const raw = await request.text();
        if (raw.length > 16384) return json({ message: "Payload too large" }, 413);
        input = JSON.parse(raw);
      } catch {
        return json({ message: "Invalid request body" }, 400);
      }
    }
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const status = await customerAccess({ MongoClient, ...db, authenticatedUserId });
      if (status !== 200) return json({ success: false,
        message: status === 403 ? "Subscription required" : "User not found" }, status);
    }
    const result = await handle({ env, MongoClient, method, authenticatedUserId, input }, path.match(pattern), url);
    return json(result.body, result.status ?? 200);
  } catch (error) {
    if (["INVALID_RULE", "INVALID_RULE_FIELD", "CONFLICTING_KEYWORDS"].includes(error?.message)) {
      return json({ message: "Invalid rule fields" }, 400);
    }
    return json({ message: "Service unavailable" }, 503);
  }
}
