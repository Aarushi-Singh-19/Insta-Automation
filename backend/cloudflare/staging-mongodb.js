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
  // Reject URI paths pointing at a different database, even though db(dbName) is explicit.
  const parsed = new URL(uri);
  const uriDatabase = decodeURIComponent(parsed.pathname.slice(1));
  if (uriDatabase && uriDatabase !== dbName) throw new Error("STAGING_URI_DATABASE_MISMATCH");
  // Explicit database selection prevents accidental production collection reads.
  // URI default databases are ignored; only the named staging DB is used.
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

// Read-only staging integration smoke test. Does not enumerate documents,
// expose customer information, or modify collections. The authenticated
// endpoint using this function must never be enabled for production traffic.
export async function inspectStagingCollections(env, MongoClient) {
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function") throw new TypeError("MongoClient constructor required");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = new Set(collections.map(item => item.name));
    return { ok: true, database: dbName, connected: true,
      checks: { users: names.has("users"), campaigns: names.has("campaigns"), rules: names.has("rules"), instagramAccounts: names.has("instagramaccounts") } };
  } finally {
    await client.close();
  }
}

// Operator-only, read-only schema diagnostic. Returns field names and BSON types,
// never field values, account IDs, tokens, email addresses or documents.
export async function inspectStagingDocumentShapes(env, MongoClient) {
  let dbName = null;
  let client = null;
  const allowed = ["instagramaccounts", "campaigns", "rules"];
  const keys = {
    instagramaccounts: ["instagramId", "igUserId", "instagramUserId", "userId", "pageId"],
    campaigns: ["userId", "instagramAccountId", "ruleIds", "automationId", "triggerType", "status", "postIds", "instagramMediaId"],
    rules: ["userId", "isActive", "triggerType", "keywords"]
  };
  let stage = "configuration";
  let result;
  let failure;
  try {
    const config = validateStagingMongoConfig(env);
    dbName = config.dbName;
    stage = "client-construction";
    if (typeof MongoClient !== "function") throw new TypeError("MongoClient required");
    client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    stage = "connect";
    await client.connect();
    stage = "query";
    const db = client.db(dbName);
    const shapes = {};
    for (const name of allowed) {
      stage = "query:" + name;
      const sample = await db.collection(name).findOne({}, {
        projection: Object.fromEntries(keys[name].map(k => [k, 1]))
      });
      shapes[name] = sample === null ? { sampleAvailable: false } : {
        sampleAvailable: true,
        fields: Object.fromEntries(keys[name].map(k => [k,
          sample[k] === undefined ? "absent"
            : Array.isArray(sample[k]) ? "array"
            : sample[k] === null ? "null"
            : sample[k]?._bsontype === "ObjectId" ? "objectId"
            : typeof sample[k]
        ]))
      };
    }
    result = { ok: true, database: dbName, connected: true, shapes };
  } catch (error) {
    const category = error?.name === "MongoServerError" ? "DATABASE_OPERATION_REJECTED"
      : ["MongoNetworkError", "MongoServerSelectionError", "MongoNetworkTimeoutError"].includes(error?.name)
        ? "DATABASE_NETWORK_ERROR" : "DATABASE_OPERATION_FAILED";
    failure = {
      ok: false, database: dbName, connected: stage === "query" || stage.startsWith("query:"),
      stage, category
    };
  }
  try {
    if (client) await client.close();
  } catch {
    // A cleanup failure must not mask a successful connection or a query failure.
    if (!failure) failure = {
      ok: false, database: dbName, connected: stage === "query" || stage.startsWith("query:"),
      stage: "cleanup", category: "DATABASE_CLEANUP_FAILED"
    };
  }
  return failure || result;
}
