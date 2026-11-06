// Explicit, single-comment Instagram public reply probe; no BullMQ or app worker imports.
// Dry-run unless REPLY_TEST_EXECUTE=true. Use a fresh comment on your own test post.
// Never paste credentials or access tokens into terminal output.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const axios = require("axios");
const InstagramAccount = require("../models/InstagramAccount");

const username = String(process.env.REPLY_TEST_IG_USERNAME || "").replace(/^@/, "").trim().toLowerCase();
const commentId = String(process.env.REPLY_TEST_COMMENT_ID || "").trim();
const postId = String(process.env.REPLY_TEST_POST_ID || "").trim();
const message = String(process.env.REPLY_TEST_MESSAGE || "TriggerDM reply test").trim();
const execute = process.env.REPLY_TEST_EXECUTE === "true";

async function main() {
  if (!username || !/^\d+$/.test(commentId) || !/^\d+$/.test(postId)) {
    throw new Error("Set REPLY_TEST_IG_USERNAME, numeric REPLY_TEST_POST_ID and REPLY_TEST_COMMENT_ID");
  }
  if (!message || message.length > 200) throw new Error("REPLY_TEST_MESSAGE must be 1..200 characters");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
  await mongoose.connect(process.env.MONGO_URI);
  const accounts = (await InstagramAccount.find({ status: "active" }))
    .filter(a => String(a.username || "").replace(/^@/, "").toLowerCase() === username);
  if (accounts.length !== 1) throw new Error("Expected exactly one matching active account");
  const account = accounts[0];
  const response = await axios.get(`https://graph.instagram.com/v25.0/${commentId}`, {
    params: { fields: "id,text,media{id},from,username,parent_id", access_token: account.accessToken },
    timeout: 15000,
  });
  const comment = response.data;
  if (String(comment.media?.id || "") !== postId) throw new Error("Comment does not belong to specified post");
  if (comment.parent_id) throw new Error("Refusing to reply to an existing reply");
  const authorName = String(comment.from?.username || comment.username || "").replace(/^@/, "").toLowerCase();
  if (!authorName || authorName === username || String(comment.from?.id || "") === String(account.instagramBusinessId)) {
    throw new Error("Refusing own-account or unidentified comment");
  }
  console.log(JSON.stringify({ mode: execute ? "EXECUTE" : "DRY_RUN", account: username, postId, commentId, author: authorName, message }));
  if (!execute) return;
  const result = await axios.post(`https://graph.instagram.com/v25.0/${commentId}/replies`, null, {
    params: { message, access_token: account.accessToken }, timeout: 15000,
  });
  console.log(JSON.stringify({ replyAccepted: Boolean(result.data?.id), replyId: result.data?.id || null }));
}
main().catch(error => {
  const apiError = error.response?.data?.error;
  console.error("Reply test failed:", apiError ? JSON.stringify({ code: apiError.code, type: apiError.type, message: apiError.message }) : error.message);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect().catch(() => {}); });
