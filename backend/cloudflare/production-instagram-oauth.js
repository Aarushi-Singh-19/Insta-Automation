import { verifySessionJwt, getTriggerDmUserId } from "./session-jwt.js";
import { cors } from "./upstream-proxy.js";
import {
  beginStagingInstagramOAuth, completeStagingInstagramOAuth, disconnectStagingInstagram,
} from "./staging-instagram-oauth.js";

export async function handleProductionInstagramOAuth({ request, env, MongoClient }) {
  if (env?.TRIGGERDM_RUNTIME !== "production") return null;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/)/, "");
  const accountId = /^\/instagram\/disconnect\/([a-f0-9]{24})$/i.exec(path)?.[1];
  const connect = path === "/instagram/connect-v2";
  const callback = path === "/instagram/callback-v2";
  if (!accountId && !connect && !callback) return null;

  const origin = request.headers.get("Origin");
  const allowed = ["https://triggerdm.in", "https://www.triggerdm.in"].includes(origin) ? cors(origin) : {};
  const headers = { ...allowed, "Cache-Control": "no-store" };
  const json = (body, status) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { headers, status: allowed["Access-Control-Allow-Origin"] ? 204 : 403 });
  if (request.method !== (accountId ? "DELETE" : "GET")) return json({ message: "Method not allowed" }, 405);

  const secret = env.PRODUCTION_JWT_SECRET;
  if (env.ENABLE_PRODUCTION_AUTH !== "true" || env.ENABLE_PRODUCTION_INSTAGRAM_OAUTH !== "true" ||
      typeof secret !== "string" || secret.length < 32 || secret === env.STAGING_JWT_SECRET) {
    return json({ message: "OAuth unavailable" }, 503);
  }
  const oauthEnv = { ...env,
    INSTAGRAM_APP_ID: env.PRODUCTION_INSTAGRAM_APP_ID,
    INSTAGRAM_APP_SECRET: env.PRODUCTION_INSTAGRAM_APP_SECRET,
    INSTAGRAM_REDIRECT_URI_V2: env.PRODUCTION_INSTAGRAM_REDIRECT_URI_V2,
    FRONTEND_URL: "https://triggerdm.in",
  };
  if (callback) {
    const redirect = new URL("/accounts", oauthEnv.FRONTEND_URL);
    try {
      const configured = new URL(oauthEnv.INSTAGRAM_REDIRECT_URI_V2);
      if (url.origin !== configured.origin || url.pathname !== configured.pathname)
        return json({ message: "Invalid OAuth callback" }, 400);
      await completeStagingInstagramOAuth({ env: oauthEnv, MongoClient,
        code: url.searchParams.get("code"), state: url.searchParams.get("state") });
    } catch (error) {
      const errorCodes = new Map([
        ["INSTAGRAM_ACCOUNT_ALREADY_CONNECTED", "instagram_account_already_connected"],
        ["ONE_INSTAGRAM_ACCOUNT_LIMIT", "one_instagram_account_limit"],
        ["INSTAGRAM_TRIAL_ALREADY_USED", "instagram_trial_already_used"],
      ]);
      redirect.searchParams.set("error", errorCodes.get(error?.message) || "instagram_connection_failed");
    }
    return new Response(null, { status: 302, headers: { ...headers, Location: redirect.href } });
  }
  let userId;
  try {
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("Authorization") || "")?.[1];
    userId = getTriggerDmUserId(await verifySessionJwt(token, secret));
  } catch {
    return json({ message: "Unauthorized" }, 401);
  }
  try {
    if (connect) return json(await beginStagingInstagramOAuth({ env: oauthEnv, userId }), 200);
    const result = await disconnectStagingInstagram({ env: oauthEnv, MongoClient, userId, accountId });
    return json(result.body, result.status);
  } catch {
    return json({ message: "OAuth unavailable" }, 503);
  }
}
