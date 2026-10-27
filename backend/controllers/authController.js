const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/emailService");

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();

if (
  user.subscriptionStatus === "trial" &&
  user.trialEndDate &&
  user.trialEndDate < now
) {
  user.subscriptionStatus = "expired";
  await user.save();
}

    res.json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// helper (keep ABOVE everything)
const sanitizeUser = (user) => {
  const userObj = user.toObject();

  // Never return credentials, reset-token material, or internal payment IDs
  // from signup, login, or the authenticated account endpoint.
  [
    "password",
    "accessToken",
    "passwordResetTokenHash",
    "passwordResetExpires",
    "razorpaySubscriptionId",
    "razorpayCustomerId",
  ].forEach((field) => {
    delete userObj[field];
  });

  return userObj;
};

// SIGNUP
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const referralCode = String(req.body.referralCode || "").trim().toUpperCase();

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

const now = new Date();

const trialEndDate = new Date();
trialEndDate.setDate(trialEndDate.getDate() + 7);

const referrer = referralCode ? await User.findOne({ referralCode }).select("_id") : null;

const user = await User.create({
  name,
  referredBy: referrer && String(referrer._id) !== String(existingUser?._id) ? referrer._id : null,
  email,
  password: hashedPassword,

  subscriptionStatus: "trial",
  currentPlan: "trial",

  trialStartDate: now,
  trialEndDate,
});
    // Email delivery must not prevent account creation.
    sendWelcomeEmail({ name: user.name, email: user.email, trialEndDate: user.trialEndDate })
      .catch((emailError) => console.error("WELCOME EMAIL ERROR:", emailError));

    res.status(201).json({
      message: "User created successfully",
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const now = new Date();

if (
  user.subscriptionStatus === "trial" &&
  user.trialEndDate &&
  user.trialEndDate < now
) {
  user.subscriptionStatus = "expired";
  await user.save();
}

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // ✅ FIXED: consistent JWT secret
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


// REQUEST PASSWORD RESET
const requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    // Always return the same message so email addresses cannot be enumerated.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const appUrl = (process.env.APP_URL || "https://triggerdm.in").replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      const sent = await sendPasswordResetEmail({ email: user.email, resetUrl });

      // Avoid leaving a valid token behind if email is not configured or delivery fails.
      if (!sent) {
        user.passwordResetTokenHash = null;
        user.passwordResetExpires = null;
        await user.save();
      }
    }

    return res.json({ message: "If an account exists for that email, a password reset link will be sent." });
  } catch (err) {
    console.error("PASSWORD RESET REQUEST ERROR:", err);
    return res.status(500).json({ message: "Unable to request a password reset right now." });
  }
};

// RESET PASSWORD WITH A SINGLE-USE TOKEN
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "A valid reset token and a password of at least 8 characters are required." });
    }

    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) {
    console.error("PASSWORD RESET ERROR:", err);
    return res.status(500).json({ message: "Unable to reset your password right now." });
  }
};

module.exports = { signup, login, getMe, requestPasswordReset, resetPassword };