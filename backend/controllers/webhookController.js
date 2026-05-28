
const { getMatchingRule } = require("../services/ruleService");

const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
  console.log("Webhook Event Received:");

  const body = req.body;
  console.log("Full Body:", JSON.stringify(body, null, 2));

  try {
    const change = body.entry?.[0]?.changes?.[0];
    const commentText = change?.value?.text;
    const username = change?.value?.from?.username;
    const field = change?.field;

    if (!commentText || !username) {
      console.log("No valid comment data found");
      return res.sendStatus(200);
    }

    console.log("Field:", field);
    console.log("Comment:", commentText);
    console.log("Username:", username);

const matchingRule = await getMatchingRule(commentText);

if (matchingRule) {

  console.log("Matched Rule:", matchingRule);

  console.log(
    `Sending DM: ${matchingRule.replyMessage}`
  );

} else {

  console.log("No matching rule found");

}

    res.sendStatus(200);
  } catch (error) {
    console.log("Error reading webhook payload");
    console.log(error.message);

    res.sendStatus(400);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};