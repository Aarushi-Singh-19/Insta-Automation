// Explicit production-only database configuration. Never infer the database
// from the MongoDB URI, and never permit a staging/system database.
const RESERVED_DATABASES = new Set(["admin", "local", "config", "test"]);
export function validateProductionMongoConfig(env, { readOnlyProbe = false } = {}) {
  if (env?.TRIGGERDM_RUNTIME !== "production") throw new Error("PRODUCTION_RUNTIME_REQUIRED");
  if (env?.PRODUCTION_CUTOVER_APPROVED !== "true" &&
      !(readOnlyProbe && env.PRODUCTION_READ_ONLY_PROBE_ENABLED === "true")) {
    throw new Error("PRODUCTION_CUTOVER_NOT_APPROVED");
  }
  if (env?.UPSTREAM_ORIGIN) throw new Error("RENDER_DEPENDENCY_STILL_CONFIGURED");
  const dbName = String(env?.MONGODB_PRODUCTION_DB || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(dbName) ||
      RESERVED_DATABASES.has(dbName.toLowerCase()) ||
      /^triggerdm_staging(?:_|$)/i.test(dbName)) {
    throw new Error("PRODUCTION_DATABASE_REQUIRED");
  }
  const uri = env?.MONGODB_PRODUCTION_URI;
  if (typeof uri !== "string" || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error("PRODUCTION_MONGODB_URI_REQUIRED");
  let parsed;
  try { parsed = new URL(uri); }
  catch { throw new Error("PRODUCTION_MONGODB_URI_INVALID"); }
  let pathDb;
  try { pathDb = decodeURIComponent(parsed.pathname.slice(1)); }
  catch { throw new Error("PRODUCTION_MONGODB_URI_INVALID"); }
  if (pathDb && pathDb !== dbName) throw new Error("PRODUCTION_URI_DATABASE_MISMATCH");
  if (!parsed.hostname || parsed.username === "" || parsed.password === "") throw new Error("PRODUCTION_CREDENTIALS_REQUIRED");
  return { uri, dbName };
}
export async function productionMongoReadiness({ env, MongoClient }) {
  const { uri, dbName } = validateProductionMongoConfig(env, { readOnlyProbe: true });
  let client;
  let stage = "client";
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    stage = "connect";
    await client.connect();
    const db = client.db(dbName);
    stage = "ping";
    await db.command({ ping: 1 });
    stage = "collections";
    const required = ["users", "instagramaccounts", "campaigns", "rules", "payments",
      "webhookevents", "referralearnings", "referralpayoutrequests", "actionlogs"];
    const inventory = await db.listCollections({ name: { $in: required } }, {
      nameOnly: true, authorizedCollections: true,
    }).toArray();
    const accessible = new Set(inventory.map(row => row.name));
    return { ok: true, database: dbName, connected: true, readOnly: true,
      collections: Object.fromEntries(required.map(name => [name, accessible.has(name)])) };
  } catch (error) {
    const category = error?.code === 18 || error?.code === 8000 ? "AUTHENTICATION_FAILED" :
      error?.code === 13 ? "ACCESS_DENIED" :
      error?.name === "MongoParseError" ? "INVALID_MONGODB_URI" :
      error?.name === "MongoServerSelectionError" ? "SERVER_SELECTION_FAILED" : "DATABASE_CHECK_FAILED";
    return { ok: false, connected: ["ping", "collections"].includes(stage), stage, category };
  } finally { if (client) await client.close().catch(() => {}); }
}
