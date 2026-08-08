class ActionBuilderService {


//   buildActionsFromSession(session) {
//   const actions = [];

//  const replyMessage = session.replyMessage?.trim();

// if (replyMessage) {
//     actions.push({
//       type: "reply",
//       username: session.username,
//       message: replyMessage,
//       campaignId: session.campaignId,
//       ruleId: session.ruleId,
//     });
//   }

// const dmMessage = session.dmMessage?.trim();

// if (dmMessage) {
//     actions.push({
//       type: "send_dm",
//       username: session.username,
//       recipientId: session.recipientId,
//       message: dmMessage,
//       campaignId: session.campaignId,
//       ruleId: session.ruleId,
//     });
//   }

//   return actions;
// }
  buildActionsFromRule(rule, username, recipientId, campaign) {
    const actions = [];
    const replyEnabled = campaign.settings?.enableReply !== false;
    const replyMessage = rule.replies?.[0];

    if (replyEnabled && replyMessage) {
      actions.push({
        type: "reply",
        username,
        message: replyMessage,
        campaignId: campaign._id,
        ruleId: rule._id,
      });
    }

    const dmMessage = campaign.settings?.dmMessage?.trim();
    if (campaign.settings?.enableDM !== false && dmMessage) {
      actions.push({
        type: "send_dm",
        username,
        recipientId,
        message: dmMessage,
        campaignId: campaign._id,
        ruleId: rule._id,
      });
    }

    return actions;
  }

  // Kept for the simulation route and callers that only expect one action.
  buildActionFromRule(rule, username, campaign) {
    return this.buildActionsFromRule(rule, username, undefined, campaign)[0] || null;
  }
}



module.exports = new ActionBuilderService();
