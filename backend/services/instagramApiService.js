const axios = require("axios");

const GRAPH_VERSION = "v19.0";

async function replyToComment({ accessToken, commentId, message }) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/replies`;

  const res = await axios.post(url, null, {
    params: {
      message,
      access_token: accessToken,
    },
  });

  return res.data;
}

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

module.exports = {
  replyToComment,
  sendDM,
};