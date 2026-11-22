import { validateProductionMongoConfig } from "./production-mongodb.js";
import { getInstagramFollowerStatus } from "./instagram-graph.js";
import { cors } from "./upstream-proxy.js";

export async function handleProductionLegacyFollow({ request, env, MongoClient, fetchImpl = fetch }) {
  if (env?.TRIGGERDM_RUNTIME !== "production" ||
      !["/api/follow/verify-follow", "/follow/verify-follow"].includes(new URL(request.url).pathname)) return null;
  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: allowed["Access-Control-Allow-Origin"] ? 204 : 403, headers });
  if (request.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);
  if (env.ENABLE_PRODUCTION_FOLLOW_GATE !== "true")
    return json({ success: false, message: "Verification unavailable" }, 503);
  let token;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ success: false, message: "Payload too large" }, 413);
    token = JSON.parse(raw)?.token;
  } catch {
    return json({ success: false, message: "Invalid request body" }, 400);
  }
  if (typeof token !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(token))
    return json({ success: false, message: "Verification token is required." }, 400);
  let client;
  try {
    const { uri, dbName } = validateProductionMongoConfig(env);
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    await client.connect();
    const db = client.db(dbName);
    const sessions = db.collection("gatesessions");
    const scope = { verificationToken: token, gateType: "FOLLOW", expiresAt: { $gt: new Date() } };
    const session = await sessions.findOne(scope);
    if (!session || !["WAITING", "COMPLETED"].includes(session.status))
      return json({ success: false, message: "Verification link is invalid or expired" }, 404);
    if (session.status === "COMPLETED") return json({ success: true, verified: true }, 200);
    const account = await db.collection("instagramaccounts").findOne({
      _id: session.instagramAccountId, userId: session.userId, status: "active",
    });
    if (!account) return json({ success: false, message: "Verification unavailable" }, 503);
    const profile = await getInstagramFollowerStatus({
      accessToken: account.pageAccessToken || account.accessToken,
      instagramScopedUserId: session.recipientId, fetchImpl,
    });
    if (profile.followsBusiness !== true)
      return json({ success: true, verified: false, message: "User is not following the account." }, 200);
    // Legacy links retain the Render service's verification-only behavior.
    await sessions.updateOne({ ...scope, _id: session._id, status: "WAITING" },
      { $set: { status: "COMPLETED", completedAt: new Date() } });
    return json({ success: true, verified: true, message: "Workflow resumed successfully." }, 200);
  } catch {
    return json({ success: false, message: "Verification unavailable" }, 503);
  } finally {
    if (client) await client.close();
  }
}
