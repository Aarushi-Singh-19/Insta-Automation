const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const followVerificationRoutes = require("./routes/followVerification.routes");
const testRoutes = require("./routes/test.routes.js");
const analyticsRoutes = require("./routes/analyticsRoutes");
const connectDB = require("./config/db");
const instagramRoutes = require("./routes/instagram.routes");
const webhookRoutes = require("./routes/webhookRoutes");
const billingRoutes = require("./routes/billing");
const razorpayWebhookRoutes = require("./routes/razorpayWebhook.routes");

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://triggerdm.in",
    "https://www.triggerdm.in"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

// Razorpay webhook must retain access to the raw request body.
app.use(
  "/api/billing/razorpay-webhook",
  razorpayWebhookRoutes
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/follow", followVerificationRoutes);
app.use("/api/test", testRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/health", require("./routes/healthRoutes"));
app.use("/api/simulate", require("./routes/simulateRoutes"));
app.use("/api/rules", require("./routes/ruleRoutes"));
app.use("/api/campaigns", require("./routes/campaigns.routes"));
app.use("/api/automations", require("./routes/automationRoutes"));
app.use("/api/campaign-health", require("./routes/campaignHealth.routes"));
app.use("/api/trend", require("./routes/trend.routes"));
app.use("/api/admin", require("./routes/admin.routes"));

app.get("/", (req, res) => {
  res.send("Backend running");
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();

    // Start the existing action worker after MongoDB connects.
    require("./workers/action.worker");

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log("✅ Instagram comment handling is webhook-driven.");
      // Polling intentionally disabled on staging. Keep pollingService.js
      // available for rollback, but do not run both event sources concurrently.
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
