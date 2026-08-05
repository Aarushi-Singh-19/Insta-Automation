
const InstagramAccount = require("../models/InstagramAccount");

const axios = require("axios");

const commentProcessor = require("./commentProcessor");

const PollingState = require("../models/PollingState.js");


let pollingInterval = null;


const initializePolling = async () => {
  let pollingState = await PollingState.findOne();

  if (!pollingState) {
    pollingState = await PollingState.create({
      initialized: false,
    });
  }

  if (pollingState.initialized) {
    console.log("✅ Polling already initialized.");
    return true;
  }

  console.log("🟡 First polling startup detected.");

  return false;
};

const startPolling = async () => {
  if (pollingInterval) {
    console.log("⚠️ Polling service already running.");
    return;
  }

  console.log("🚀 Starting Polling Service...");

  const alreadyInitialized = await initializePolling();

  if (!alreadyInitialized) {
  console.log(
    "⏳ Historical bootstrap will run before live polling."
  );
}

pollingInterval = setInterval(async () => {
  try {
    const accounts = await InstagramAccount.find({});

    console.log(
      `📱 Found ${accounts.length} connected account(s)`
    );

for (const account of accounts) {
  console.log(
    `📱 Polling ${account.username}`
  );

  try {
    const response = await axios.get(
      "https://graph.instagram.com/me/media",
      {
params: {
  fields: "id,timestamp",
  limit: 5,
  access_token: account.accessToken,
},
      }
    );

    const media = response.data.data || [];

    console.log(
      `📸 Found ${media.length} media`
    );

    for (const post of media) {
try {
  const commentsResponse = await axios.get(
    `https://graph.instagram.com/${post.id}/comments`,
    {
      params: {
        fields: "id,text,from,timestamp",
        access_token: account.accessToken,
      },
    }
  );

  const comments = commentsResponse.data.data || [];

  console.log(
    `💬 ${post.id} -> ${comments.length} comment(s)`
  );

for (const comment of comments) {

  // Skip comments made by the account owner
 if (
    !comment.from ||
    comment.from.username === account.username
) {
    continue;
}
//   await commentProcessor.processComment({
//     eventId: comment.id,
//     postId: post.id,
//     commentText: comment.text,
//     username: comment.from?.username,
//     recipientId: comment.from?.id,
//   });

console.log("NEW COMMENT:", {
    id: comment.id,
    username: comment.from.username,
    text: comment.text,
});
}

} catch (error) {
  console.error(
    `Failed to fetch comments for ${post.id}`,
    error.response?.data || error.message
  );
}
    }

  } catch (error) {
    console.error(
      `❌ Failed for ${account.username}:`,
      error.response?.data || error.message
    );
  }
}

  } catch (error) {
    console.error(
      "Polling Error:",
      error
    );
  }
}, 10000);
};

module.exports = {
  startPolling,
};