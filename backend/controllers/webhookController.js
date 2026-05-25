const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === "my_verify_token") {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
};

const receiveWebhook = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Webhook event received",
    data: req.body,
  });
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};