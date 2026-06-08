const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const Rule = require("../models/Rule");

// Simulate Instagram comment event
router.post("/comment", auth, async (req, res) => {
  try {
    const { commentText } = req.body;

    if (!commentText) {
      return res.status(400).json({ message: "commentText required" });
    }

    // Get user rules only
    const rules = await Rule.find({});
console.log(rules);

    let matchedRule = null;

    for (let rule of rules) {
      if (rule.triggerType === "any") {
        matchedRule = rule;
        break;
      }

      const keywords = rule.triggerKeywords || [];

      if (
        keywords.some((keyword) =>
          commentText.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      return res.json({
        success: true,
        message: "No rule matched",
      });
    }

    // Pick reply
    let reply = "";

    if (matchedRule.replyMode === "single") {
      reply = matchedRule.replies[0];
    } else {
      reply =
        matchedRule.replies[
          Math.floor(Math.random() * matchedRule.replies.length)
        ];
    }

    res.json({
      success: true,
      matchedRule: matchedRule.ruleName,
      reply,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;