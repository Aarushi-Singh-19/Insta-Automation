const InstagramAccount = require("../models/InstagramAccount");
const instagramApiService = require("../services/instagramApiService");

const testFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const account = await InstagramAccount.findOne({
      userId: req.user.id,
      status: "active",
    });

    if (!account) {
      return res.status(404).json({
        error: "Instagram account not connected",
      });
    }

    const profile =
      await instagramApiService.getUserProfile({
        accessToken:
          account.pageAccessToken || account.accessToken,
        instagramScopedUserId: userId,
      });

    return res.json(profile);
  } catch (err) {
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
};

module.exports = {
  testFollowStatus,
};