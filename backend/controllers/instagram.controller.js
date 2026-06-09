const axios = require("axios");

const connectInstagram = async (req, res) => {
  try {
const scopes = [
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

    const authUrl =
      `https://www.facebook.com/v23.0/dialog/oauth` +
      `?client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(
        process.env.META_REDIRECT_URI
      )}` +
      `&scope=${scopes}` +
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



const instagramCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code missing",
      });
    }

    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v23.0/oauth/access_token",
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code,
        },
      }
    );

console.log("ACCESS TOKEN RESPONSE:");
console.log(tokenResponse.data);

const accessToken = tokenResponse.data.access_token;

const meResponse = await axios.get(
  "https://graph.facebook.com/v23.0/me",
  {
    params: {
      fields: "id,name",
      access_token: accessToken,
    },
  }
);

console.log("ME RESPONSE:");
console.log(meResponse.data);

const pagesResponse = await axios.get(
  "https://graph.facebook.com/v23.0/me/accounts",
  {
    params: {
      access_token: accessToken,
    },
  }
);

console.log("PAGES RESPONSE:");
console.log(JSON.stringify(pagesResponse.data, null, 2));

return res.json({
  success: true,
  me: meResponse.data,
  pages: pagesResponse.data,
});
  } catch (error) {
    console.error(error.response?.data || error);

    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
};

module.exports = {
  connectInstagram,
  instagramCallback,
};
