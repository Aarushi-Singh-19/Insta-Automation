const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const followVerificationRoutes = require("./routes/followVerification.routes");
const testRoutes = require("./routes/test.routes.js");
const pollingService = require("./services/pollingService.js");
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

// Keep the Razorpay raw-body route before express.json().
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

    // Start the BullMQ worker only after MongoDB connects.
    require("./workers/action.worker");

    app.listen(PORT, async () => {
      console.log(`✅ Server running on port ${PORT}`);

      // Do not disable polling until Meta delivery to staging is confirmed.
      // Set INSTAGRAM_WEBHOOK_ONLY=true on the staging service to cut over.
      if (process.env.INSTAGRAM_WEBHOOK_ONLY === "true") {
        console.log("✅ Instagram webhook-only mode enabled.");
      } else {
        console.log("⚠️ Instagram webhook-only mode is off; polling fallback enabled.");
        await pollingService.startPolling();
      }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
