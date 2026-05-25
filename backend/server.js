require("dotenv").config();

const express = require("express");
const healthRoutes = require("./routes/healthRoutes");

const app = express();

app.use(express.json());

app.use("/api/health", healthRoutes);

app.get("/", (req, res) => {
  res.send("Instagram Comment-to-DM Automation Backend is running");
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});