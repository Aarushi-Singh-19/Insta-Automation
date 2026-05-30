const jwt = require("jsonwebtoken");
const auth = (req, res, next) => {
  console.log("🔥 AUTH MIDDLEWARE HIT");
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // ✅ standard way

    next();
  } catch (err) {
    console.log("JWT ERROR:", err.message);

    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;