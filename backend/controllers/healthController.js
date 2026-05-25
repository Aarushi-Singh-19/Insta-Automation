const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: "Health API is working",
  });
};

module.exports = { healthCheck };