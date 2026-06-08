const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const analyticsRoutes = require("./routes/analyticsRoutes");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/health", require("./routes/healthRoutes"));
app.use("/api/simulate", require("./routes/simulateRoutes"));
app.use("/webhook", require("./routes/webhookRoutes"));
app.use("/api/rules", require("./routes/ruleRoutes"));
app.use("/api/campaigns", require("./routes/campaigns.routes"));
app.use("/api/campaign-health", require("./routes/campaignHealth.routes"));
app.use("/api/trend", require("./routes/trend.routes"));

app.get("/", (req, res) => {
  res.send("Backend running");
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();

    // Start BullMQ worker only after DB connection
    require("./workers/action.worker");

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();