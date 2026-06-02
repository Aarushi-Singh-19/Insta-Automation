const Campaign = require("../models/campaign.model");

// FIND ACTIVE CAMPAIGN BY POST ID
const findActiveCampaignByPost = async (postId) => {
  return await Campaign.findOne({
    postId,
    status: "active",
  }).populate("ruleIds");
};

module.exports = {
  findActiveCampaignByPost,
};