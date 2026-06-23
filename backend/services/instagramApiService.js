const axios = require("axios");

const GRAPH_VERSION = "v19.0";

async function replyToComment({ accessToken, commentId, message }) {
  try {
    console.log("REPLY ATTEMPT");
    console.log("COMMENT ID:", commentId);
    console.log("TOKEN LENGTH:", accessToken?.length);

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/replies`;

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

async function sendDM({ accessToken, igUserId, message }) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/messages`;

  const res = await axios.post(
    url,
    {
      recipient: { id: igUserId },
      message: { text: message },
    },
    {
      params: {
        access_token: accessToken,
      },
    }
  );

  return res.data;
}

module.exports = {
  replyToComment,
  sendDM,
};