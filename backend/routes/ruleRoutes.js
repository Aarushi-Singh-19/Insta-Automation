const express = require("express");
const router = express.Router();

const subscriptionMiddleware = require("../middleware/subscriptionMiddleware");

const auth = require("../middleware/authMiddleware");

const {
  createRule,
  getRules,
  updateRule,
  deleteRule,
  toggleRuleStatus,
} = require("../controllers/ruleController");

// Protected routes
router.patch(
  "/:id/toggle",
  auth,
  subscriptionMiddleware,
  toggleRuleStatus
);
router.post(
  "/",
  auth,
  subscriptionMiddleware,
  createRule
);
router.get("/", auth, getRules);
router.post(
  "/",
  auth,
  subscriptionMiddleware,
  createRule
);
router.delete("/:id", auth, deleteRule);

module.exports = router;