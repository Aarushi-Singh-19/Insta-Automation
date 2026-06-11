
const InstagramAccount = require("../models/InstagramAccount");
const {
  exchangeCodeForToken,
  getInstagramUser,
} = require("../services/instagramService");

const connectInstagram = async (req, res) => {
  try {
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
    ].join(",");

    const authUrl =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI)}` +
      `&state=${req.user.id}` +   // 🔥 STEP 2 FIX
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;

    return res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const axios = require("axios");

const instagramCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Missing authorization code",
      });
    }

    // STEP 1: Exchange code for access token
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token`,
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // STEP 2: Get pages
    const pagesRes = await axios.get(
      `https://graph.facebook.com/me/accounts`,
      {
        params: { access_token: accessToken },
      }
    );

    const page = pagesRes.data.data?.[0];

    if (!page) {
      return res.status(400).json({
        success: false,
        message: "No Facebook Page found. Convert account to Business/Creator.",
      });
    }

    // STEP 3: Get Instagram Business Account
    const igRes = await axios.get(
      `https://graph.facebook.com/${page.id}`,
      {
        params: {
          fields: "instagram_business_account",
          access_token: accessToken,
        },
      }
    );

    const instagramId =
      igRes.data.instagram_business_account?.id;

const userId = req.query.state;

if (!userId) {
  return res.status(400).json({
    success: false,
    message: "Missing user context (state)",
  });
}

const savedAccount = await InstagramAccount.findOneAndUpdate(
  {
    userId,
    instagramBusinessId: instagramId,
  },
  {
    userId,
    instagramBusinessId: instagramId,
    pageId: page.id,
    accessToken,
    status: "active",
    connectedAt: new Date(),
  },
  { upsert: true, new: true }
);

return res.json({
  success: true,
  message: "Instagram connected successfully",
  data: savedAccount,
});

  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Instagram connection failed",
    });
  }
};

module.exports = {
  connectInstagram,
  instagramCallback,
};

