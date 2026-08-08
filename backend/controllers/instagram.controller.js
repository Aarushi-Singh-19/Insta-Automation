const jwt = require("jsonwebtoken");
const axios = require("axios");
const InstagramAccount = require("../models/InstagramAccount.js");

/**
 * STEP 1: Redirect to Facebook OAuth
 */
const connectInstagram = (req, res) => {
  console.log("REQ USER:", req.user);
console.log("REQ USER ID:", req.user?.id);
const state = jwt.sign(
  {
    userId: req.user.id,
  },
  process.env.JWT_SECRET
);

  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${process.env.META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI)}` +
    `&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_comments,instagram_manage_messages` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

     console.log("APP ID:", process.env.META_APP_ID);
  console.log("OAUTH URL:", url);

  return res.redirect(url);
};

/**
 * STEP 2: OAuth callback → fetch IG business account → save to DB
 */
const instagramCallback = async (req, res) => {
  try {
    console.log("CALLBACK USER:", req.user);
    const { code, state } = req.query;

    if (!state) {
  return res.status(400).json({
    success: false,
    message: "Missing OAuth state",
  });
}

const decodedState = jwt.verify(
  state,
  process.env.JWT_SECRET
);

const userId = decodedState.userId;

console.log("OAuth User ID:", userId);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Missing OAuth code",
      });
    }

    // -----------------------------
    // 1. Exchange code for access token
    // -----------------------------
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
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

  const permissionsRes = await axios.get(
  "https://graph.facebook.com/v19.0/me/permissions",
  {
    params: {
      access_token: accessToken,
    },
  }
);


console.log(
  "PERMISSIONS:",
  JSON.stringify(permissionsRes.data, null, 2)
);
const meRes = await axios.get(
  "https://graph.facebook.com/v19.0/me",
  {
    params: {
      access_token: accessToken,
      fields: "id,name",
    },
  }
);

console.log(
  "FACEBOOK USER:",
  JSON.stringify(meRes.data, null, 2)
);

const debugPages = await axios.get(
  `https://graph.facebook.com/v19.0/${meRes.data.id}/accounts`,
  {
    params: {
      access_token: accessToken,
    },
  }
);

console.log(
  "DEBUG ACCOUNTS:",
  JSON.stringify(debugPages.data, null, 2)
);
console.log("USER ACCESS TOKEN RECEIVED");
    // -----------------------------
    // 2. Get Facebook Pages
    // -----------------------------
const pagesRes = await axios.get(
  "https://graph.facebook.com/v19.0/me/accounts",
  {
    params: {
      access_token: accessToken,
      fields: "id,name,access_token",
    },
  }
);

console.log(
  "PAGES RESPONSE FULL:",
  JSON.stringify(pagesRes.data, null, 2)
);
    console.log("PAGES RESPONSE:", pagesRes.data);

    const pages = pagesRes.data?.data || [];

    console.log(
  "PAGES RESPONSE:",
  JSON.stringify(pagesRes.data, null, 2)
);

    if (!pages.length) {
      return res.status(400).json({
        success: false,
        message: "No Facebook Pages found for this account",
      });
    }

    let savedAccount = null;

    // -----------------------------
    // 3. Find Instagram Business Account
    // -----------------------------
    for (const page of pages) {
      const igRes = await axios.get(
        `https://graph.facebook.com/${page.id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: page.access_token,
          },
        }
      );

      const igId =
        igRes.data?.instagram_business_account?.id;

      if (!igId) continue;

      // Get IG profile
      const igProfile = await axios.get(
        `https://graph.facebook.com/${igId}`,
        {
          params: {
            fields: "id,username",
            access_token: page.access_token,
          },
        }
      );

      // -----------------------------
      // 4. Save / Upsert in DB
      // -----------------------------
savedAccount =await InstagramAccount.findOneAndUpdate(
  {
    userId: decodedState.userId,
  },
  {
    userId,

    instagramBusinessId: igId,

    pageId: page.id,

    username: igProfile.data.username,

    accessToken,

    pageAccessToken: page.access_token,

    status: "active",

    lastSyncedAt: new Date(),
  },
  {
    upsert: true,
    new: true,
    runValidators: true,
  }
);

      break; // stop after first valid IG account
    }

    // -----------------------------
    // 5. If nothing found
    // -----------------------------
    if (!savedAccount) {
      return res.status(400).json({
        success: false,
        message:
          "No Instagram Business Account linked to any Facebook Page",
      });
    }

    // -----------------------------
    // 6. Success response
    // -----------------------------
    return res.json({
      success: true,
      message: "Instagram connected successfully",
      data: savedAccount,
    });
  } catch (error) {
    console.error(
      "❌ Instagram OAuth Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: "Instagram connection failed",
    });
  }
};


const connectInstagramV2 = async (req, res) => {
  try {
    const state = jwt.sign(
      {
        userId: req.user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10m",
      }
    );

    console.log(
  "AUTH REDIRECT URI:",
  process.env.INSTAGRAM_REDIRECT_URI_V2
);

    const authUrl =
      `https://www.instagram.com/oauth/authorize` +
      `?force_reauth=true` +
      `&client_id=${process.env.INSTAGRAM_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(
        process.env.INSTAGRAM_REDIRECT_URI_V2
      )}` +
      `&response_type=code` +
      `&scope=` +
      [
        "instagram_business_basic",
        "instagram_business_manage_comments",
        "instagram_business_manage_messages"
      ].join(",") +
      `&state=${encodeURIComponent(state)}`;

    console.log("INSTAGRAM LOGIN URL:");
    console.log(authUrl);
console.log("APP ID:", process.env.INSTAGRAM_APP_ID);
console.log("REDIRECT URI:", process.env.INSTAGRAM_REDIRECT_URI_V2);
console.log("AUTH URL:", authUrl);
    return res.json({
      success: true,
      authUrl,
    });

    
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// helper funciton


const subscribeInstagramAccount = async (instagramUserId, accessToken) => {
console.log("🔥🔥🔥 HELPER ENTERED 🔥🔥🔥");
  console.log("IG USER:", instagramUserId);

  try {
    const response = await axios.post(
      `https://graph.instagram.com/v25.0/${instagramUserId}/subscribed_apps`,
      new URLSearchParams({
        subscribed_fields:
  "comments,messages,messaging_postbacks",
      }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("SUBSCRIBE RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (err) {
    console.log("SUBSCRIBE FAILED:");
    console.log(err.response?.data || err.message);
    throw err;
  }
};

// const subscribeInstagramAccount = async (instagramUserId, accessToken) => {
//   try {
//     const response = await axios.post(
//       `https://graph.instagram.com/v25.0/${instagramUserId}/subscribed_apps`,
//       new URLSearchParams({
//         subscribed_fields: "comments,messages",
//       }),
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     console.log(
//       "SUBSCRIBE RESPONSE:",
//       JSON.stringify(response.data, null, 2)
//     );

//     return response.data;
//   } catch (error) {
//     console.error(
//       "SUBSCRIBE ERROR:",
//       error.response?.data || error.message
//     );

//     throw error;
//   }
// };




const instagramCallbackV2 = async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log("INSTAGRAM CODE:");
    console.log(code);

    console.log("INSTAGRAM STATE:");
    console.log(state);

    const decodedState = jwt.verify(
      state,
      process.env.JWT_SECRET
    );

    console.log(
      "DECODED STATE:",
      decodedState
    );

    console.log(
  "TOKEN EXCHANGE REDIRECT URI:",
  process.env.INSTAGRAM_REDIRECT_URI_V2
);

    const tokenResponse = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri:
          process.env.INSTAGRAM_REDIRECT_URI_V2,
        code,
      }),
      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
      }
    );

    console.log(
      "TOKEN RESPONSE:",
      JSON.stringify(
        tokenResponse.data,
        null,
        2
      )
    );
    
console.log(
  "TOKEN PERMISSIONS:",
  tokenResponse.data.permissions
);
    const accessToken = tokenResponse.data.access_token;

    const instagramUserId = tokenResponse.data.user_id;

console.log("TOKEN USER ID:", instagramUserId);

const longLivedTokenResponse = await axios.get(
  "https://graph.instagram.com/access_token",
  {
    params: {
      grant_type: "ig_exchange_token",
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      access_token: accessToken,
    },
  }
);

const longLivedAccessToken =
  longLivedTokenResponse.data.access_token;

console.log(
  "LONG LIVED TOKEN:",
  JSON.stringify(longLivedTokenResponse.data, null, 2)
);

console.log("TOKEN USER ID:", instagramUserId);

let mediaResponse;

console.log("ACCESS TOKEN RECEIVED");
console.log("INSTAGRAM USER ID:", instagramUserId);

try {
  const profileResponse = await axios.get(
    "https://graph.instagram.com/me",
    {
      params: {
        fields: "id,username",
        access_token: longLivedAccessToken,
      },
    }
  );

  const graphUserId = profileResponse.data.id;

console.log("GRAPH USER ID:", graphUserId);
console.log("TOKEN USER ID:", instagramUserId);

  console.log(
  "PROFILE USER ID:",
  profileResponse.data.id
);

console.log(
  "PROFILE USERNAME:",
  profileResponse.data.username
);

console.log("🔥🔥🔥 VERSION 25 JULY - CALLING SUBSCRIBE 🔥🔥🔥");

await subscribeInstagramAccount(
  graphUserId,
  longLivedAccessToken
);

console.log("🔥🔥🔥 VERSION 25 JULY - FINISHED SUBSCRIBE 🔥🔥🔥");
//temprorayry removing
// await subscribeInstagramAccount(
//     graphUserId,
//     longLivedTokenResponse.data.access_token
// );

console.log("ABOUT TO SAVE INSTAGRAM ACCOUNT", {
  userId: decodedState.userId,
 instagramBusinessId:
    graphUserId.toString(),
  username:
    profileResponse.data.username,
});

const savedAccount =
  await InstagramAccount.findOneAndUpdate(
    {
      userId: decodedState.userId,
   instagramBusinessId:
    graphUserId.toString(),
    },
    {
      userId: decodedState.userId,

     instagramBusinessId:
    graphUserId.toString(),

      pageId:
    graphUserId.toString(),

      username:
        profileResponse.data.username,

accessToken: longLivedAccessToken,
pageAccessToken: longLivedAccessToken,
tokenExpiresAt: new Date(
  Date.now() + longLivedTokenResponse.data.expires_in * 1000
),

      status: "active",

      lastSyncedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );




console.log(
  "INSTAGRAM ACCOUNT SAVED:",
  savedAccount
);

  console.log(
    "INSTAGRAM PROFILE:",
    JSON.stringify(
      profileResponse.data,
      null,
      2
    )
  );

  console.log("REACHED ACCOUNT INFO");

  const accountInfo = await axios.get(
  "https://graph.instagram.com/me",
  {
    params: {
      fields:
        "id,username,account_type",
     access_token: longLivedAccessToken,
    },
  }
);

console.log(
  "ACCOUNT INFO:",
  JSON.stringify(
    accountInfo.data,
    null,
    2
  )
);

// console.log("REACHED MEDIA DEBUG");

// const mediaDebug = await axios.get(
//   `https://graph.instagram.com/${profileResponse.data.id}/media`,
//   {
//     params: {
//       fields: "id,caption,comments_count",
//       access_token: longLivedAccessToken,
//     },
//   }
// );

// console.log(
//   "MEDIA DEBUG:",
//   JSON.stringify(
//     mediaDebug.data,
//     null,
//     2
//   )
// );

console.log("REACHED ME MEDIA");
 
  try {
  mediaResponse = await axios.get(
    "https://graph.instagram.com/me/media",
    {
      params: {
        fields: "id,caption,permalink",
        access_token: longLivedAccessToken,
      },
    }
  );

  console.log(
    "MEDIA RESPONSE:",
    JSON.stringify(
      mediaResponse.data,
      null,
      2
    )
  );
} catch (mediaError) {
  console.error(
    "MEDIA ERROR:",
    mediaError.response?.data ||
      mediaError.message
  );
}

} catch (profileError) {
  console.error(
    "PROFILE/SAVE ERROR:",
    profileError.response?.data || profileError
  );

  throw profileError;
}
try {
// const firstMediaId =
//   mediaResponse?.data?.data?.[0]?.id;
//temp change
const firstMediaId =
  mediaResponse?.data?.data?.[0]?.id;

  console.log(
    "TEST MEDIA ID:",
    firstMediaId
  );

console.log(
  "MEDIA FULL:",
  JSON.stringify(
    mediaResponse.data,
    null,
    2
  )
);

  if (firstMediaId) {
const commentsUrl =
  `https://graph.instagram.com/v25.0/${firstMediaId}/comments`;

console.log(
  "COMMENTS URL:",
  commentsUrl
);

const commentsResponse = await axios.get(
  commentsUrl,
  {
    params: {
      access_token: longLivedAccessToken,
      limit: 100,
    },
  }
);

console.log(
  "RAW COMMENTS RESPONSE:",
  JSON.stringify(
    commentsResponse.data,
    null,
    2
  )
);
console.log(
  "COMMENTS COUNT:",
  commentsResponse.data?.data?.length
);
  }
} catch (commentsError) {
  console.error(
    "COMMENTS ERROR:",
    commentsError.response?.data ||
      commentsError.message
  );
}

return res.redirect(`${process.env.FRONTEND_URL}/accounts`);
  } catch (error) {
  console.error("========== CALLBACK FAILED ==========");

  console.error("Message:", error.message);

  console.error("Status:", error.response?.status);

  console.error(
    "Response:",
    JSON.stringify(error.response?.data, null, 2)
  );

  console.error("Request URL:", error.config?.url);

  console.error("Request Params:", error.config?.params);

  console.error(error.stack);

  return res.status(500).json({
    success: false,
    error: error.response?.data || error.message,
  });
}
};

  const getConnectedAccounts = async (req, res) => {
  try {
    const accounts = await InstagramAccount.find({
      userId: req.user.id,
    }).select(
      "username status connectedAt lastSyncedAt"
    );

    return res.json({
      success: true,
      data: accounts,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch accounts",
    });
  }
};

const getInstagramMedia = async (req, res) => {
  try {
    // 1. Find connected Instagram account
    const account = await InstagramAccount.findOne({
      userId: req.user.id,
      status: "active",
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "No connected Instagram account found",
      });
    }

    // 2. Fetch media from Instagram Graph API
    const mediaResponse = await axios.get(
      "https://graph.instagram.com/me/media",
      {
        params: {
          fields:
            "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
          access_token: account.accessToken,
        },
      }
    );

    return res.json({
      success: true,
      data: mediaResponse.data.data,
    });
  } catch (error) {
  console.error("GET MEDIA ERROR");
  console.error("Status:", error.response?.status);
  console.error("Response:", error.response?.data);
  console.error("Message:", error.message);

  return res.status(500).json({
    success: false,
    error: error.response?.data || error.message,
  });
}
};

console.log({
  connectInstagram,
  instagramCallback,
  connectInstagramV2,
  instagramCallbackV2,
  
});

const disconnectInstagram = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await InstagramAccount.findOne({
      _id: accountId,
      userId: req.user.id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Instagram account not found",
      });
    }

    await InstagramAccount.findByIdAndDelete(accountId);

    return res.json({
      success: true,
      message: "Instagram account disconnected successfully",
    });
  } catch (error) {
    console.error("DISCONNECT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to disconnect Instagram account",
    });
  }
};

module.exports = {
  connectInstagram,
  instagramCallback,
  connectInstagramV2,
  instagramCallbackV2,
  getConnectedAccounts,
  getInstagramMedia,
  disconnectInstagram,
};

