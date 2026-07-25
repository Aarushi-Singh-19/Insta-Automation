const axios = require("axios");

async function test() {
  try {
    const res = await axios.post(
      "https://graph.instagram.com/v25.0/17939326452069902/replies",
      null,
      {
        params: {
          message: "TriggerDM Test Reply 🚀",
          access_token: "IGAATJcmTAetFBZAFpPaEZA4MWYtbjRvbEVOQ3BQWnRYMTFuU0JDSVpNSVNtdEUxbF96Y0VJQTZAIMXp3SWswTkl2d2QzZAkNHVXBkX0haUlN6UjAzcHYwNWJseU1SbmV4dnAzcEpJMnNSdjVfZA2lmenptRmZA3"
        }
      }
    );

    console.log(res.data);
  } catch (e) {
    console.log(
      JSON.stringify(e.response?.data || e.message, null, 2)
    );
  }
}

test();