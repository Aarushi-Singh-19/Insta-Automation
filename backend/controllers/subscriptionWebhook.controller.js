const crypto = require("crypto");
const User = require("../models/User");
const Payment = require("../models/Payment");

const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSignature =
      req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay webhook signature",
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== webhookSignature) {
      console.log("❌ Invalid Razorpay webhook signature");

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(req.body.toString());

    console.log(
      "🔥 RAZORPAY WEBHOOK:",
      event.event
    );

    const subscription =
      event.payload?.subscription?.entity;

    const payment =
      event.payload?.payment?.entity;

    // =========================================
    // SUBSCRIPTION ACTIVATED
    // =========================================

    if (
      event.event ===
        "subscription.activated" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "active";
        user.currentPlan = "starter";

        user.subscriptionCurrentStart =
          subscription.current_start
            ? new Date(
                subscription.current_start * 1000
              )
            : null;

        user.subscriptionCurrentEnd =
          subscription.current_end
            ? new Date(
                subscription.current_end * 1000
              )
            : null;

        user.planEndDate =
          user.subscriptionCurrentEnd;

        await user.save();

        console.log(
          "✅ SUBSCRIPTION ACTIVATED:",
          user._id
        );
      }
    }

    // =========================================
    // PAYMENT CAPTURED
    // =========================================

    if (
      event.event === "payment.captured" &&
      payment
    ) {
      const subscriptionId =
        payment.subscription_id;

      if (subscriptionId) {
        const user = await User.findOne({
          razorpaySubscriptionId:
            subscriptionId,
        });

        if (user) {
          user.subscriptionStatus = "active";

          if (payment.amount) {
            const existingPayment =
              await Payment.findOne({
                paymentId: payment.id,
              });

            if (!existingPayment) {
              await Payment.create({
                userId: user._id,
                orderId:
                  payment.order_id || subscriptionId,
                paymentId: payment.id,
                amount:
                  payment.amount / 100,
                status: "success",
              });
            }
          }

          await user.save();

          console.log(
            "💰 PAYMENT CAPTURED:",
            payment.id
          );
        }
      }
    }

    // =========================================
    // PAYMENT FAILED
    // =========================================

    if (
      event.event === "payment.failed" &&
      payment
    ) {
      const subscriptionId =
        payment.subscription_id;

      if (subscriptionId) {
        const user = await User.findOne({
          razorpaySubscriptionId:
            subscriptionId,
        });

        if (user) {
          user.subscriptionStatus =
            "past_due";

          await user.save();

          console.log(
            "⚠️ PAYMENT FAILED:",
            user._id
          );
        }
      }
    }

    // =========================================
    // SUBSCRIPTION HALTED
    // =========================================

    if (
      event.event ===
        "subscription.halted" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "halted";

        await user.save();

        console.log(
          "⛔ SUBSCRIPTION HALTED:",
          user._id
        );
      }
    }

    // =========================================
    // SUBSCRIPTION CANCELLED
    // =========================================

    if (
      event.event ===
        "subscription.cancelled" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus =
          "cancelled";

        await user.save();

        console.log(
          "🚫 SUBSCRIPTION CANCELLED:",
          user._id
        );
      }
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = {
  handleRazorpayWebhook,
};