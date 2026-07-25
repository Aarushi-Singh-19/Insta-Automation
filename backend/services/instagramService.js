const axios = require("axios");


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
  
  getInstagramUser,
};