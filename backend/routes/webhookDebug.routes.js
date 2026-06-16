const express = require("express");

const router = express.Router();

router.post("/", (req, res) => {
  console.log(
    "INSTAGRAM WEBHOOK EVENT:",
    JSON.stringify(req.body, null, 2)
  );

  res.sendStatus(200);
});

module.exports = router;