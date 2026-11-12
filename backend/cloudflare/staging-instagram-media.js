import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";

// Read-only media listing using an existing staging account token.
// Never expose the token or upstream Graph error payload to the browser.
export async function listStagingInstagramMedia({ env, MongoClient, authenticatedUserId, search = "", fetchImpl = fetch }) {
  if (typeof authenticatedUserId !== "string" || !/^[a-f0-9]{24}$/i.test(authenticatedUserId)) throw new TypeError("AUTHENTICATED_USER_REQUIRED");
  const { uri, dbName } = validateStagingMongoConfig(env);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  let token;
  try {
    await client.connect();
    const account = await client.db(dbName).collection("instagramaccounts").findOne(
      { userId: new ObjectId(authenticatedUserId), status: "active" },
      { projection: { accessToken: 1 } }
    );
    token = account?.accessToken;
  } finally {
    await client.close();
  }
  if (!token) return { status: 404, body: { success: false, message: "No connected Instagram account found" } };
  const query = String(search).trim().toLowerCase().slice(0, 256);
  const normalize = value => String(value || "").split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  const results = [];
  let next = new URL("https://graph.instagram.com/me/media");
  next.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
  next.searchParams.set("limit", "100");
  for (let page = 0; page < (query ? 20 : 1) && next; page++) {
    const response = await fetchImpl(next.toString(), {
      method: "GET", headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) return { status: 502, body: { success: false, message: "Instagram media temporarily unavailable" } };
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) return { status: 502, body: { success: false, message: "Invalid Instagram media response" } };
    results.push(...payload.data.filter(post => !query ||
      String(post.caption || "").toLowerCase().includes(query) ||
      normalize(post.permalink).includes(normalize(query))));
    const nextUrl = payload.paging?.next;
    if (!query || !nextUrl) break;
    const candidate = new URL(nextUrl);
    // Only follow Instagram-owned HTTPS pagination URLs; never forward tokens elsewhere.
    if (candidate.protocol !== "https:" || candidate.hostname !== "graph.instagram.com") break;
    next = candidate;
  }
  return { status: 200, body: { success: true, data: results } };
}
