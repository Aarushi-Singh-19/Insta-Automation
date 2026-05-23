const express = require("express");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

app.use(express.json());

app.use("/api/health", healthRoutes);

app.get("/", (req, res) => {
  res.send("Instagram Comment-to-DM Automation Backend is running");
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});