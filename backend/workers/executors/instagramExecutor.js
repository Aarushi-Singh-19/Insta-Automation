const {
  replyToComment,
  sendDM,
} = require("../../services/instagramApiService");

const { rateLimit } = require("../../utils/rateLimiter");
const { withRetry } = require("../../utils/retryHandler");

async function executeInstagramAction(job) {
  const { type, payload, account } = job.data;

  const accessToken =
  tokenResponse.data.access_token;

const instagramUserId =
  tokenResponse.data.user_id;

  const profileResponse = await axios.get(
  `https://graph.instagram.com/v23.0/${instagramUserId}`,
  {
    params: {
      fields: "id,username",
      access_token: accessToken,
    },
  }
);

console.log(
  "INSTAGRAM PROFILE:",
  JSON.stringify(
    profileResponse.data,
    null,
    2
  )
);

  await rateLimit(accountId);

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
        igUserId: payload.igUserId,
        message: payload.message,
      })
    );
  }

  throw new Error(`Unknown action type: ${type}`);
}

module.exports = { executeInstagramAction };