// Verify a staging Follow Gate postback against Meta before unlocking.
// No outgoing messages. Never trust a postback's claimed follow status.
import { ObjectId } from "mongodb";
import { validateStagingMongoConfig } from "./staging-mongodb.js";
import { getInstagramFollowerStatus } from "./instagram-graph.js";
import { confirmFollowGate } from "./follow-gate-state.js";

export async function verifyStagingFollowPostback({
  env, MongoClient, postback, fetchImpl, getFollower = getInstagramFollowerStatus,
  confirm = confirmFollowGate
}) {
  if (env?.ENABLE_STAGING_FOLLOW_VERIFICATION !== "true") return { skipped: "disabled" };
  const { uri, dbName } = validateStagingMongoConfig(env);
  if (typeof MongoClient !== "function" || typeof fetchImpl !== "function") throw new TypeError("DEPENDENCIES_REQUIRED");
  const accountId = String(postback?.entryId || "");
  const senderId = String(postback?.senderId || "");
  const payload = postback?.postback?.payload;
  // Only session-specific, unambiguous verification payloads are accepted.
  const match = typeof payload === "string" && /^VERIFY:follow:comment:([0-9]+):([0-9]+)$/.exec(payload);
  if (!match || match[1] !== accountId || !/^[0-9]+$/.test(senderId)) {
    return { unlocked: false, reason: "UNTRUSTED_POSTBACK" };
  }
  const sessionId = payload.slice("VERIFY:".length);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const session = await db.collection("cloudflare_staging_follow_gate_sessions").findOne({
      _id: sessionId, status: "WAITING", recipientId: senderId,
      inboxId: "comment:" + accountId + ":" + match[2]
    });
    if (!session) return { unlocked: false, reason: "SESSION_NOT_WAITING" };
    if (!/^[a-f0-9]{24}$/i.test(String(session.userId || ""))) return { unlocked: false, reason: "INVALID_SESSION_OWNER" };
    const account = await db.collection("instagramaccounts").findOne({
      instagramBusinessId: accountId, userId: new ObjectId(String(session.userId)), status: "active"
    });
    if (!account?.accessToken) return { unlocked: false, reason: "ACCOUNT_UNAVAILABLE" };
    let follower;
    try {
      follower = await getFollower({ accessToken: account.accessToken,
        instagramScopedUserId: senderId, fetchImpl });
    } catch {
      return { unlocked: false, reason: "FOLLOW_STATUS_UNAVAILABLE" };
    }
    if (follower?.followsBusiness !== true) return { unlocked: false, reason: "FOLLOW_NOT_VERIFIED" };
    const result = await confirm({ db, sessionId, followerStatus: true, senderId, accountId });
    return { ...result, instagramMessagesSent: 0 };
  } finally {
    await client.close();
  }
}
