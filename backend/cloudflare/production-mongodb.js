// Explicit production-only database configuration. Never infer the database
// from the MongoDB URI, and never permit a staging/system database.
const RESERVED_DATABASES = new Set(["admin", "local", "config", "test"]);
export function validateProductionMongoConfig(env) {
  if (env?.TRIGGERDM_RUNTIME !== "production") throw new Error("PRODUCTION_RUNTIME_REQUIRED");
  if (env?.PRODUCTION_CUTOVER_APPROVED !== "true") throw new Error("PRODUCTION_CUTOVER_NOT_APPROVED");
  if (env?.UPSTREAM_ORIGIN) throw new Error("RENDER_DEPENDENCY_STILL_CONFIGURED");
  const dbName = String(env?.MONGODB_PRODUCTION_DB || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(dbName) ||
      RESERVED_DATABASES.has(dbName.toLowerCase()) ||
      /^triggerdm_staging(?:_|$)/i.test(dbName)) {
    throw new Error("PRODUCTION_DATABASE_REQUIRED");
  }
  const uri = env?.MONGODB_PRODUCTION_URI;
  if (typeof uri !== "string" || !/^mongodb(?:\\+srv)?:\\/\\//.test(uri)) throw new Error("PRODUCTION_MONGODB_URI_REQUIRED");
  let parsed;
  try { parsed = new URL(uri); }
  catch { throw new Error("PRODUCTION_MONGODB_URI_INVALID"); }
  const pathDb = decodeURIComponent(parsed.pathname.slice(1));
  if (pathDb && pathDb !== dbName) throw new Error("PRODUCTION_URI_DATABASE_MISMATCH");
  if (!parsed.hostname || parsed.username === "" || parsed.password === "") throw new Error("PRODUCTION_CREDENTIALS_REQUIRED");
  return { uri, dbName };
}
export async function productionMongoReadiness({ env, MongoClient }) {
  const { uri, dbName } = validateProductionMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    return { ok: true, database: dbName, connected: true, readOnly: true };
  } finally { await client.close(); }
}
