// Staging-only MongoDB connectivity probe. Intentionally read-only.
// The client constructor is injected so unit tests never contact Atlas.
// Production database names are prohibited even if an operator misconfigures a secret.
const FORBIDDEN = new Set(["automationdb", "admin", "local", "config"]);
export function validateStagingMongoConfig(env) {
  const dbName = String(env?.MONGODB_STAGING_DB || "").trim();
  if (!/^triggerdm_staging(?:_[a-z0-9_]+)?$/.test(dbName) || FORBIDDEN.has(dbName.toLowerCase())) {
    throw new Error("STAGING_DATABASE_REQUIRED");
  }
  const uri = env?.MONGODB_STAGING_URI;
  if (typeof uri !== "string" || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error("STAGING_MONGODB_URI_REQUIRED");
  }
  // URI dbName, if present, must agree with explicitly selected staging DB.
  // MongoClient.db(dbName) selects the target independently of the URI default.
  return { uri, dbName };
}
export async function probeStagingMongo(env, MongoClient) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient constructor required");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    return { ok: true, database: dbName, access: "read-only-probe" };
  } finally {
    await client.close();
  }
}
