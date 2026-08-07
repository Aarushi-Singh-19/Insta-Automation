const Campaign = require("../models/campaign.model");

// FIND ACTIVE CAMPAIGN BY POST ID (USER-SAFE)
const findActiveCampaignByPost = async (postId) => {
  console.log("SEARCHING CAMPAIGN FOR:", postId);

const result = await Campaign.findOne({
  status: "active",
  $or: [
    { triggerType: "any-post" },
    {
      triggerType: "specific-post",
      postIds: { $in: [postId] },
    },
  ],
})
  .sort({ createdAt: -1 })
  .populate("ruleIds");

  if (result) {
    console.log("FOUND:", result._id);
    return result;
  }

  // A next-post campaign is claimed by the first post that generates a
  // comment event. The atomic update prevents two webhook deliveries from
  // claiming different posts for the same campaign.
  const nextPostCampaign = await Campaign.findOneAndUpdate(
    {
      status: "active",
      triggerType: "next-post",
      $or: [{ postIds: { $exists: false } }, { postIds: { $size: 0 } }],
    },
    {
      $set: {
        triggerType: "specific-post",
        instagramMediaId: postId,
        postIds: [postId],
      },
    },
    { new: true }
  ).populate("ruleIds");

  console.log("FOUND:", nextPostCampaign ? nextPostCampaign._id : null);

  return nextPostCampaign;
};

module.exports = {
  findActiveCampaignByPost,
};
