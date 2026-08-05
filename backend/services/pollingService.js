const InstagramAccount = require("../models/InstagramAccount");
const PollingState = require("../models/PollingState");
const axios = require("axios");

const commentProcessor = require("./commentProcessor");

const ProcessedEvent = require("../models/processedEvent.model.js");

let pollingInterval = null;
const POLLING_INTERVAL = 10000;

/**
 * Placeholder.
 * Will be implemented in the next step.
 */
const bootstrapHistoricalComments = async () => {
  console.log("📦 Bootstrapping historical comments...");

  const operations = [];

  const accounts = await InstagramAccount.find({});

  for (const account of accounts) {
    console.log(`📱 Bootstrapping ${account.username}`);

    try {
      const mediaResponse = await axios.get(
        "https://graph.instagram.com/me/media",
        {
          params: {
            fields: "id",
            limit: 5,
            access_token: account.accessToken,
          },
        }
      );

      const media = mediaResponse.data.data || [];

      for (const post of media) {
        try {
          const commentsResponse = await axios.get(
            `https://graph.instagram.com/${post.id}/comments`,
            {
              params: {
                fields: "id,from",
                access_token: account.accessToken,
              },
            }
          );

          const comments = commentsResponse.data.data || [];

          for (const comment of comments) {
            if (
              !comment.from ||
              comment.from.username === account.username
            ) {
              continue;
            }

            operations.push({
              updateOne: {
                filter: {
                  eventId: comment.id,
                },
                update: {
                  $setOnInsert: {
                    eventId: comment.id,
                    type: "comment",
                    status: "processed",
                  },
                },
                upsert: true,
              },
            });
          }
        } catch (err) {
          console.error(
            `Bootstrap failed for media ${post.id}`,
            err.response?.data || err.message
          );
        }
      }
    } catch (err) {
      console.error(
        `Bootstrap failed for account ${account.username}`,
        err.response?.data || err.message
      );
    }
  }

  if (operations.length > 0) {
    const result = await ProcessedEvent.bulkWrite(
      operations,
      {
        ordered: false,
      }
    );

    console.log(
      `✅ Seeded ${result.upsertedCount} historical comments`
    );
  } else {
    console.log("ℹ️ No historical comments found.");
  }

  await PollingState.updateOne(
    {},
    {
      initialized: true,
      initializedAt: new Date(),
    }
  );

  console.log("✅ Historical bootstrap complete.");
};

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

const pollComments = async (account, post) => {
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

      const alreadyProcessed = await ProcessedEvent.exists({
  eventId: comment.id,
});

if (alreadyProcessed) {
  continue;
}
      // await commentProcessor.processComment({
      //   eventId: comment.id,
      //   postId: post.id,
      //   commentText: comment.text,
      //   username: comment.from?.username,
      //   recipientId: comment.from?.id,
      // });

await commentProcessor.processComment({
  eventId: comment.id,
  postId: post.id,
  commentText: comment.text,
  username: comment.from?.username,
  recipientId: comment.from?.id,
});
    }
  } catch (error) {
    console.error(
      `Failed to fetch comments for ${post.id}`,
      error.response?.data || error.message
    );
  }
};

const pollMedia = async (account) => {
  try {
    console.log(`📱 Polling ${account.username}`);

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
      await pollComments(account, post);
    }
  } catch (error) {
    console.error(
      `❌ Failed for ${account.username}:`,
      error.response?.data || error.message
    );
  }
};

const pollAccounts = async () => {
  const accounts = await InstagramAccount.find({});

  console.log(
    `📱 Found ${accounts.length} connected account(s)`
  );

  for (const account of accounts) {
    await pollMedia(account);
  }
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

    await bootstrapHistoricalComments();
  }

  pollingInterval = setInterval(async () => {
    try {
      await pollAccounts();
    } catch (error) {
      console.error("Polling Error:", error);
    }
  }, POLLING_INTERVAL);
};

module.exports = {
  startPolling,
};