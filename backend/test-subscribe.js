const axios = require("axios");

async function test() {
  try {
    const res = await axios.post(
      "https://graph.instagram.com/v25.0/27759473043638911/subscribed_apps",
      new URLSearchParams({
        subscribed_fields: "comments,messages",
      }),
      {
        headers: {
          Authorization: "Bearer IGAATJcmTAetFBZAFpPaEZA4MWYtbjRvbEVOQ3BQWnRYMTFuU0JDSVpNSVNtdEUxbF96Y0VJQTZAIMXp3SWswTkl2d2QzZAkNHVXBkX0haUlN6UjAzcHYwNWJseU1SbmV4dnAzcEpJMnNSdjVfZA2lmenptRmZA3",
          "Content-Type": "application/x-www-form-urlencoded",
        },
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