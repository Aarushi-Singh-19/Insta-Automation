const {
  replyToComment,
  sendDM,
} = require("../../services/instagramApiService");

const { rateLimit } = require("../../utils/rateLimiter");
const { withRetry } = require("../../utils/retryHandler");

async function executeInstagramAction(job) {
  const { type, payload, account } = job.data;

  const accessToken =
    account.pageAccessToken || account.accessToken;

  await rateLimit(account._id.toString());

  if (type === "REPLY_COMMENT") {
    return await withRetry(() =>
      replyToComment({
        accessToken,
        commentId: payload.commentId,
        message: payload.message,
      })
    );
  }

  if (type === "SEND_DM") {
    return await withRetry(() =>
      sendDM({
        accessToken,
        instagramBusinessId: account.instagramBusinessId,
        commentId: payload.commentId,
        recipientId: payload.recipientId,
        message: payload.message,
      })
    );
  }

  throw new Error(`Unknown action type: ${type}`);
}

module.exports = { executeInstagramAction };