const { checkKeywordMatch } = require("../utils/keywordMatcher");
const { sendDM } = require("../services/dmService");

const { automationRules } = require("../data/automationRules");


const verifyWebhook =  (req, res) => {
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
    
    const sortedRules = [...automationRules].sort(
      (a, b) => a.priority - b.priority
    );
const matchedRule = sortedRules.find((rule) =>  {

  if (rule.triggerType === "any") {
    return true;
  }

  if (rule.triggerType === "keywords") {
    return rule.triggerKeywords.some((keyword) =>
      checkKeywordMatch(commentText, keyword)
    );
  }

  return false;
});

if (matchedRule) {
let messageToSend = "";

if (matchedRule.replyMode === "single") {

  messageToSend = matchedRule.replies[0];

}

if (matchedRule.replyMode === "random") {

  const randomIndex = Math.floor(
    Math.random() * matchedRule.replies.length
  );

  messageToSend = matchedRule.replies[randomIndex];
}

console.log("Matched Rule:", matchedRule.ruleName);

await sendDM(username, messageToSend);
} else {
  console.log("No matching keyword found");
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