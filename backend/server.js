require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const healthRoutes = require("./routes/healthRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// DB connection
connectDB();

// Middleware (MUST come first)
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/webhook", webhookRoutes);
app.use("/api/rules", ruleRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Instagram Comment-to-DM Automation Backend is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});