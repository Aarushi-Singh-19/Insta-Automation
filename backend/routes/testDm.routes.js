const express = require("express");
const router = express.Router();

const InstagramAccount = require("../models/InstagramAccount");
const instagramApiService = require("../services/instagramApiService");

router.post("/", async (req, res) => {
  try {
    const { commentId, message } = req.body;

    const account = await InstagramAccount.findOne({
      status: "active",
    });

    if (!account) {
      return res.status(404).json({
        error: "No connected Instagram account",
      });
    }

    console.log("Page Token:", account.pageAccessToken);
console.log("User Token:", account.accessToken);

    console.log("Using account:", account.username);
    console.log("IG User ID:", account.instagramBusinessId);
    console.log("Comment ID:", commentId);

    const result = await instagramApiService.sendDM({
      accessToken: account.pageAccessToken || account.accessToken,
      instagramBusinessId: account.instagramBusinessId,
      commentId,
      message,
    });

    return res.json(result);
  } catch (err) {
    console.error(err.response?.data || err);

    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});

module.exports = router;