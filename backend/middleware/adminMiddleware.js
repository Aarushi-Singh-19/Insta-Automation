const User = require("../models/User");
const authMiddleware = require("./authMiddleware");

// Admin access is granted only to the account whose email is configured
// in the server-side ADMIN_EMAIL environment variable.
module.exports = async (req, res, next) => {
  try {
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!configuredAdminEmail) {
      return res.status(503).json({ message: "Admin dashboard is not configured." });
    }

    const user = await User.findById(req.user.id).select("email");
    if (!user || String(user.email || "").trim().toLowerCase() !== configuredAdminEmail) {
      return res.status(403).json({ message: "Admin access required." });
    }

    next();
  } catch (error) {
    console.error("ADMIN AUTHORIZATION ERROR:", error);
    return res.status(500).json({ message: "Unable to verify admin access." });
  }
};
