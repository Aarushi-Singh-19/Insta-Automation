const axios = require("axios");

const GRAPH_VERSION = "v25.0";

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

    // const url =  // temproray removing 
    //   `https://graph.facebook.com/${GRAPH_VERSION}/` +
    //   `${instagramBusinessId}/messages`;

    const url =
  `https://graph.instagram.com/${GRAPH_VERSION}/` +
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
async function sendFollowGateMessage({
  accessToken,
  instagramBusinessId,
  commentId,
  recipientId,
  openingMessage,
  buttonText,
  profileUrl,
  verificationToken,
}) {
  try {
    if (!commentId && !recipientId) {
      throw new Error("FOLLOW_GATE_RECIPIENT_REQUIRED");
    }

    if (!verificationToken) {
      throw new Error("FOLLOW_GATE_TOKEN_REQUIRED");
    }

    const url =
      `https://graph.instagram.com/${GRAPH_VERSION}/` +
      `${instagramBusinessId}/messages`;

    const recipient = commentId
      ? { comment_id: commentId }
      : { id: recipientId };


const payload = {
  recipient,
  message: {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text:
          openingMessage ||
          "Follow us to unlock your DM.",
        buttons: [
          {
            type: "web_url",
            url: profileUrl,
            title: "Visit Profile",
          },
          {
            type: "web_url",
            title: buttonText || "I'm Following",
            url: `https://triggerdm.in/follow/verify?token=${encodeURIComponent(
              verificationToken
            )}`,
          },
        ],
      },
    },
  },
};


    console.log("FOLLOW GATE RECIPIENT:", {
      commentId,
      recipientId,
      usingCommentId: Boolean(commentId),
    });

    console.log(
      "FOLLOW GATE PAYLOAD:",
      JSON.stringify(payload, null, 2)
    );

    const res = await axios.post(url, payload, {
      params: {
        access_token: accessToken,
      },
    });

    console.log("FOLLOW GATE DM SUCCESS:", res.data);

    return res.data;
  } catch (err) {
    console.log(
      "FOLLOW GATE DM ERROR:",
      JSON.stringify(
        err.response?.data || err.message,
        null,
        2
      )
    );

    throw err;
  }
}
