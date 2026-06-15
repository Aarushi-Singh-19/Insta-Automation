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
savedAccount = await InstagramAccount.findOneAndUpdate(
  {
    userId,
    instagramBusinessId: igId,
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

    const accessToken = tokenResponse.data.access_token;
const instagramUserId = tokenResponse.data.user_id;

let mediaResponse;

console.log("ACCESS TOKEN RECEIVED");
console.log("INSTAGRAM USER ID:", instagramUserId);

try {
  const profileResponse = await axios.get(
    "https://graph.instagram.com/me",
    {
      params: {
        fields: "id,username",
        access_token: accessToken,
      },
    }
  );

  console.log(
    "INSTAGRAM PROFILE:",
    JSON.stringify(
      profileResponse.data,
      null,
      2
    )
  );

} catch (profileError) {
  console.error(
    "PROFILE LOOKUP ERROR:",
    profileError.response?.data || profileError.message
  );
}
try {
  mediaResponse = await axios.get(
    "https://graph.instagram.com/me/media",
    {
      params: {
        fields: "id,caption",
        access_token: accessToken,
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


try {
  const firstMediaId =
    mediaResponse.data?.data?.[0]?.id;

  console.log(
    "TEST MEDIA ID:",
    firstMediaId
  );

  if (firstMediaId) {
    const commentsResponse = await axios.get(
      `https://graph.instagram.com/${firstMediaId}/comments`,
      {
        params: {
          access_token: accessToken,
        },
      }
    );

    console.log(
      "COMMENTS RESPONSE:",
      JSON.stringify(
        commentsResponse.data,
        null,
        2
      )
    );
  }
} catch (commentsError) {
  console.error(
    "COMMENTS ERROR:",
    commentsError.response?.data ||
      commentsError.message
  );
}

    return res.json({
      success: true,
      tokenResponse: tokenResponse.data,
    });
  } catch (error) {
    console.error(
      "V2 TOKEN ERROR:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error:
        error.response?.data || error.message,
    });
  }
};
console.log({
  connectInstagram,
  instagramCallback,
  connectInstagramV2,
  instagramCallbackV2,
});
module.exports = {
  connectInstagram,
  instagramCallback,
  connectInstagramV2,
  instagramCallbackV2,
};