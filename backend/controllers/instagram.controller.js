const axios = require("axios");

const connectInstagram = async (req, res) => {
  try {
    const scopes = [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
      "instagram_business_content_publish",
      "instagram_business_manage_insights",
    ].join(",");

    const authUrl =
      `https://www.instagram.com/oauth/authorize` +
      `?force_reauth=true` +
      `&client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(
        process.env.META_REDIRECT_URI
      )}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}`;

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



const instagramCallback = async (req, res) => {
  try {
    const { code } = req.query;

    console.log("CODE RECEIVED:", code);

    return res.json({
      success: true,
      code,
      message: "Instagram Login successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  connectInstagram,
  instagramCallback,
};
