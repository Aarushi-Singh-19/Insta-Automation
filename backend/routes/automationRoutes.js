const express = require("express");
const router = express.Router();

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
  updateAutomation
);

module.exports = router;