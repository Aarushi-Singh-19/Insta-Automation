const axios = require("axios");

const exchangeCodeForToken = async (code) => {
  const response = await axios.post(
    "https://api.instagram.com/oauth/access_token",
    new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      code,
    }),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data;
};

const getInstagramUser = async (accessToken) => {
  const response = await axios.get(
    "https://graph.instagram.com/me",
    {
      params: {
        fields: "id,username",
        access_token: accessToken,
      },
    }
  );

  return response.data;
};

module.exports = {
  exchangeCodeForToken,
  getInstagramUser,
};