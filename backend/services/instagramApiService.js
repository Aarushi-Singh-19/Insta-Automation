const axios = require("axios");

const GRAPH_VERSION = "v19.0";

async function replyToComment({ accessToken, commentId, message }) {
  try {
    console.log("REPLY ATTEMPT");
    console.log("COMMENT ID:", commentId);
    console.log("TOKEN LENGTH:", accessToken?.length);

    const url = `https://graph.instagram.com/${GRAPH_VERSION}/${commentId}/replies`;

    const res = await axios.post(url, null, {
 params: {
    message,
    access_token: accessToken,
},
    });

    console.log("REPLY SUCCESS:", res.data);

    return res.data;
  } catch (err) {
    console.log(
      "REPLY ERROR:",
      JSON.stringify(err.response?.data || err.message, null, 2)
    );

    throw err;
  }
}

async function sendDM({
  accessToken,
  instagramBusinessId,
  commentId,
  recipientId,
  message,
}) {
  try {
    const recipient = commentId
      ? { comment_id: commentId }
      : recipientId
      ? { id: recipientId }
      : null;

    if (!recipient) {
      throw new Error("DM_RECIPIENT_REQUIRED");
    }

    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/` +
      `${instagramBusinessId}/messages`;

    const res = await axios.post(
      url,
      {
        recipient,
        message: { text: message },
      },
      {
  params: {
    access_token: accessToken,
},
      }
    );

    console.log("DM SUCCESS:", res.data);

    return res.data;
  } catch (err) {
    console.log(
      "DM ERROR:",
      JSON.stringify(err.response?.data || err.message, null, 2)
    );

    throw err;
  }
}

module.exports = {
  replyToComment,
  sendDM,
};
