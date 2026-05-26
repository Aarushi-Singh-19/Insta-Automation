const automationRules = [
  {
    ruleName: "Default Link Rule",
    priority: 1,
    triggerType: "keywords",
    triggerKeywords: ["link", "details", "form"],
    replyMode: "single",
    replies: ["Hey! Check your DM."],
  },

  {
    ruleName: "Pricing Rule",
    priority: 2,
    triggerType: "keywords",
    triggerKeywords: ["price", "cost", "fees"],
    replyMode: "single",
    replies: ["Hey! Pricing details have been sent to your DM."],
  },

  {
    ruleName: "Any Comment Pro Rule",
    priority: 99,
    triggerType: "any",
    triggerKeywords: [],
    replyMode: "random",
    replies: [
      "Hey! Just dropped you a DM.",
      "Check your DM, sent you the details.",
      "Done! I’ve shared everything in your DM.",
    ],
  },
];

module.exports = { automationRules };