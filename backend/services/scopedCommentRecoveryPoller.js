// Opt-in, account/post-scoped fallback for missing Instagram comment webhooks.
// Disabled unless all three RECOVERY_POLL_* environment variables are supplied.
// Starts from the moment the service boots: never replays historical comments.
const axios = require("axios");
const InstagramAccount = require("../models/InstagramAccount");
const ProcessedEvent = require("../models/processedEvent.model");
const { processComment } = require("./commentProcessor");

let timer;
let busy = false;
const INTERVAL_MS = 30000;

async function pollOnce({ username, postId, startedAt }) {
  if (busy) return;
  busy = true;
  try {
    const accounts = (await InstagramAccount.find({ status: "active" }))
      .filter(a => String(a.username || "").replace(/^@/, "").toLowerCase() === username);
    if (accounts.length !== 1) {
      console.warn("[RecoveryPoll] Account missing or ambiguous; skipped");
      return;
    }
    const account = accounts[0];
    const res = await axios.get(`https://graph.instagram.com/v25.0/${postId}/comments`, {
      params: { fields: "id,text,from,username,timestamp,parent_id", limit: 50, access_token: account.accessToken },
      timeout: 15000,
    });
    const comments = res.data.data || [];
    for (const c of comments) {
      const timestamp = Date.parse(c.timestamp || "");
      const authorName = String(c.from?.username || c.username || "").replace(/^@/, "").toLowerCase();
      const authorId = String(c.from?.id || "");
      if (!c.id || !c.text || !authorId || !authorName || c.parent_id ||
          authorName === username || authorId === String(account.instagramBusinessId) ||
          !Number.isFinite(timestamp) || timestamp < startedAt ||
          timestamp > Date.now() + 60000 || Date.now() - timestamp > 10 * 60 * 1000) continue;
      if (await ProcessedEvent.exists({ eventId: c.id })) continue;
      try {
        await processComment({
          eventId: c.id, postId, commentText: c.text,
          username: authorName, recipientId: authorId, commentTimestamp: c.timestamp,
        });
        console.log("[RecoveryPoll] Processed comment:", c.id);
      } catch (err) {
        // Do not leak tokens in API error objects.
        console.error("[RecoveryPoll] Comment processing failed:", c.id, err.message);
      }
    }
    if (res.data.paging?.next) console.warn("[RecoveryPoll] More than 50 comments; additional pages not scanned");
  } catch (err) {
    console.error("[RecoveryPoll] Poll failed:", err.response?.data?.error?.message || err.message);
  } finally {
    busy = false;
  }
}

function start() {
  if (timer) return;
  if (process.env.RECOVERY_POLL_ENABLED !== "true") return;
  const username = String(process.env.RECOVERY_POLL_USERNAME || "").replace(/^@/, "").trim().toLowerCase();
  const postId = String(process.env.RECOVERY_POLL_POST_ID || "").trim();
  if (!username || !/^\d+$/.test(postId)) {
    console.error("[RecoveryPoll] Invalid account or post configuration; disabled");
    return;
  }
  const startedAt = Date.now();
  console.log("[RecoveryPoll] Enabled for one account and post; fresh comments only");
  timer = setInterval(() => pollOnce({ username, postId, startedAt }), INTERVAL_MS);
  timer.unref?.();
}

module.exports = { start };
