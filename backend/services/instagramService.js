const axios = require("axios");


const getInstagramUser = async (accessToken) => {
  const response = await axios.get(
    
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