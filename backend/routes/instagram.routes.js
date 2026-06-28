const express = require("express");
const router = express.Router();

const {
  connectInstagram,
  instagramCallback,
  connectInstagramV2,
  instagramCallbackV2,
  getConnectedAccounts,
  getInstagramMedia,
  disconnectInstagram,
} = require("../controllers/instagram.controller");

const authMiddleware = require("../middleware/authMiddleware");

// Instagram Login V2
router.get(
  "/connect-v2",
  authMiddleware,
  connectInstagramV2
);

router.get(
  "/callback-v2",
  instagramCallbackV2
);

// Existing Facebook Login Flow
router.get(
  "/connect",
  authMiddleware,
  connectInstagram
);

router.get(
  "/callback",
  instagramCallback
);

router.get(
  "/accounts",
  authMiddleware,
  getConnectedAccounts
);

router.get(
  "/media",
  authMiddleware,
  getInstagramMedia
);

router.delete(
  "/disconnect/:accountId",
  authMiddleware,
  disconnectInstagram
);

module.exports = router;