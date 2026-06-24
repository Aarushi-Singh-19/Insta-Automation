const express = require("express");
const router = express.Router();

const subscriptionMiddleware = require("../middleware/subscriptionMiddleware");

const authMiddleware = require("../middleware/authMiddleware");


const {
  createAutomation,
  getAutomations,
  deleteAutomation,
   updateAutomation,
} = require("../controllers/automationController");

router.post(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  createAutomation
);

router.get(
  "/",
  authMiddleware,
  getAutomations
);

router.delete(
  "/:id",
  authMiddleware,
  deleteAutomation
);


router.put(
  "/:id",
  authMiddleware,
  subscriptionMiddleware,
  updateAutomation
);

module.exports = router;