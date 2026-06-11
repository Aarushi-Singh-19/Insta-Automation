const express = require("express");
const router = express.Router();

const {
  connectInstagram,
  instagramCallback,
} = require("../controllers/instagram.controller");

const authMiddleware = require("../middleware/authMiddleware");

// STEP 1: protect connect route
router.get("/connect", authMiddleware, connectInstagram);

// callback stays public
router.get("/callback", instagramCallback);

module.exports = router;