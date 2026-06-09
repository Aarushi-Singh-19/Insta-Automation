const express = require("express");
const router = express.Router();

const {
  connectInstagram,
  instagramCallback,
} = require("../controllers/instagram.controller");

router.get("/connect", connectInstagram);
router.get("/callback", instagramCallback);

module.exports = router;