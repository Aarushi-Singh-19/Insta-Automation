const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  createRule,
  getRules,
  updateRule,
  deleteRule,
  toggleRuleStatus,
} = require("../controllers/ruleController");

// Protected routes
router.patch("/:id/toggle", auth, toggleRuleStatus);
router.post("/", auth, createRule);
router.get("/", auth, getRules);
router.put("/:id", auth, updateRule);
router.delete("/:id", auth, deleteRule);

module.exports = router;