const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");

const healthRoutes = require("./routes/healthRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const authRoutes = require("./routes/authRoutes");
const simulateRoutes = require("./routes/simulateRoutes");
const campaignRoutes = require("./routes/campaigns.routes");

const app = express();

// DB
connectDB();

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/simulate", simulateRoutes);
app.use("/webhook", webhookRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/campaigns", campaignRoutes);

// test
app.get("/", (req, res) => {
  res.send("Backend running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});