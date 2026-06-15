const Campaign = require("../models/campaign.model");

// FIND ACTIVE CAMPAIGN BY POST ID (USER-SAFE)
const findActiveCampaignByPost = async (postId) => {
  console.log("SEARCHING CAMPAIGN FOR:", postId);

const result = await Campaign.findOne({
  status: "active",
  postIds: {
    $in: [postId],
  },
}).populate("ruleIds");

  console.log("FOUND:", result ? result._id : null);

  return result;
};

module.exports = {
  findActiveCampaignByPost,
};