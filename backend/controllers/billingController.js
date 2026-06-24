const Razorpay = require("razorpay");

const createOrder = async (req, res) => {
  res.json({
    message: "Coming soon"
  });
};


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = {
  createOrder,
  razorpay,
};