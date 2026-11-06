// One-shot, account-scoped recovery utility. Not loaded by the web server.
// Dry-run by default. Requires explicit RECOVERY_EXECUTE=true to process comments.
// Example: RECOVERY_IG_USERNAME=aarushisingh.19 RECOVERY_POST_ID=18080979662081300 node scripts/recoverInstagramComments.js
require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const InstagramAccount = require("../models/InstagramAccount");
const Campaign = require("../models/campaign.model");
const ProcessedEvent = require("../models/processedEvent.model");
const { processComment } = require("../services/commentProcessor");

const username = String(process.env.RECOVERY_IG_USERNAME || "").replace(/^@/, "").trim().toLowerCase();
const postId = String(process.env.RECOVERY_POST_ID || "").trim();
const execute = process.env.RECOVERY_EXECUTE === "true";
const maxAgeMinutes = Number(process.env.RECOVERY_MAX_AGE_MINUTES || 30);
const maxComments = Number(process.env.RECOVERY_MAX_COMMENTS || 20);

async function main() {
  if (!username || !/^\\d+$/.test(postId)) throw new Error("RECOVERY_IG_USERNAME and numeric RECOVERY_POST_ID are required");
  if (!Number.isInteger(maxAgeMinutes) || maxAgeMinutes < 1 || maxAgeMinutes > 60) throw new Error("RECOVERY_MAX_AGE_MINUTES must be 1..60");
  if (!Number.isInteger(maxComments) || maxComments < 1 || maxComments > 50) throw new Error("RECOVERY_MAX_COMMENTS must be 1..50");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
  await mongoose.connect(process.env.MONGO_URI);
  const accounts = await InstagramAccount.find({ status: "active", username: new RegExp("^" + username.replace(/[.*+?^\x24{}()|[\\]\\]/g, "\\$&") + "$", "i") });
  if (accounts.length !== 1) throw new Error("Expected exactly one matching active Instagram account");
  const account = accounts[0];
  const campaigns = await Campaign.find({ userId: account.userId, status: "active", postIds: postId }).select("_id");
  if (!campaigns.length) throw new Error("No active campaign for this account/post");
  const response = await axios.get(`https://graph.instagram.com/${postId}/comments`, {
    params: { fields: "id,text,from,username,timestamp,parent_id", limit: maxComments, access_token: account.accessToken },
    timeout: 15000,
  });
  const comments = response.data.data || [];
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  let eligible = 0;
  for (const comment of comments) {
    const author = comment.from;
    const authorName = String(author?.username || comment.username || "").toLowerCase();
    const authorId = String(author?.id || "");
    const timestamp = Date.parse(comment.timestamp || "");
    if (!comment.id || !comment.text || !authorId || !authorName || comment.parent_id ||
        authorId === String(account.instagramBusinessId) || authorName === username ||
        !Number.isFinite(timestamp) || timestamp < cutoff || timestamp > Date.now() + 60000 ||
        await ProcessedEvent.exists({ eventId: comment.id })) continue;
    eligible++;
    console.log(JSON.stringify({ eventId: comment.id, postId, ageMinutes: Math.round((Date.now() - timestamp) / 60000), mode: execute ? "EXECUTE" : "DRY_RUN" }));
    if (execute) {
      await processComment({ eventId: comment.id, postId, commentText: comment.text,
        username: authorName, recipientId: authorId, commentTimestamp: comment.timestamp });
    }
  }
  console.log(JSON.stringify({ scanned: comments.length, eligible, mode: execute ? "EXECUTE" : "DRY_RUN", hasNextPage: Boolean(response.data.paging?.next) }));
  if (response.data.paging?.next) console.warn("Additional comment pages exist; this run intentionally checks only the first page.");
}

main().catch(error => { console.error("Recovery aborted:", error.response?.data?.error?.message || error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect().catch(() => {}); });
