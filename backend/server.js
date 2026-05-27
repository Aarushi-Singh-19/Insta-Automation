require("dotenv").config();

const express = require("express");

const healthRoutes = require("./routes/healthRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

app.use(express.json());

const ruleRoutes = require("./routes/ruleRoutes");
app.use("/api/rules", ruleRoutes);

app.use("/api/health", healthRoutes);
app.use("/webhook", webhookRoutes);

app.get("/", (req, res) => {
  res.send("Instagram Comment-to-DM Automation Backend is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});