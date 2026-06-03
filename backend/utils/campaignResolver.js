const Campaign = require("../models/campaign.model");

// FIND ACTIVE CAMPAIGN BY POST ID
const findActiveCampaignByPost = async (postId) => {
  console.log("SEARCHING CAMPAIGN FOR:", postId);

  const result = await Campaign.findOne({
    postId: postId,
  }).populate("ruleIds");

  console.log("FOUND:", result);

  return result;
};

module.exports = {
  findActiveCampaignByPost,
};