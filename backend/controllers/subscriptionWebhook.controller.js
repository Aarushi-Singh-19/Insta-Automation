const crypto = require("crypto");

const User = require("../models/User");
const Payment = require("../models/Payment");
const WebhookEvent = require("../models/WebhookEvent");

const handleRazorpayWebhook = async (req, res) => {
  try {
    // ==========================================
    // 1. GET RAW BODY + SIGNATURE
    // ==========================================

    const webhookSignature =
      req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message:
          "Missing Razorpay webhook signature",
      });
    }

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Missing webhook body",
      });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body);

    // ==========================================
    // 2. VERIFY RAZORPAY SIGNATURE
    // ==========================================

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
      .update(rawBody)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(webhookSignature)
      )
    ) {
      console.error(
        "❌ Invalid Razorpay webhook signature"
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // ==========================================
    // 3. PARSE WEBHOOK
    // ==========================================

    const event = JSON.parse(
      rawBody.toString("utf8")
    );

    const eventId = event.id;
    const eventType = event.event;

    if (!eventId || !eventType) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay webhook payload",
      });
    }

    console.log(
      "🔥 RAZORPAY WEBHOOK:",
      eventType,
      eventId
    );

    // ==========================================
    // 4. IDEMPOTENCY CHECK
    // ==========================================

    const existingEvent =
      await WebhookEvent.findOne({
        eventId,
      });

    if (existingEvent) {
      console.log(
        "♻️ Duplicate Razorpay webhook ignored:",
        eventId
      );

      return res.status(200).json({
        success: true,
        duplicate: true,
      });
    }

    const subscription =
      event.payload?.subscription?.entity;

    const payment =
      event.payload?.payment?.entity;

    // ==========================================
    // 5. SUBSCRIPTION AUTHENTICATED
    // ==========================================

    if (
      eventType ===
        "subscription.authenticated" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        /*
         * IMPORTANT:
         *
         * Authenticated does NOT mean paid/active
         * for our TriggerDM entitlement.
         *
         * The customer has only authorized the
         * recurring mandate.
         */
        console.log(
          "🔐 SUBSCRIPTION AUTHENTICATED:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 6. SUBSCRIPTION ACTIVATED
    // ==========================================

    if (
      eventType ===
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
          subscription.id
        );
      }
    }

    // ==========================================
    // 7. SUBSCRIPTION CHARGED
    // ==========================================

    if (
      eventType === "subscription.charged" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        /*
         * A successful recurring charge means
         * the subscription remains active.
         */

        user.subscriptionStatus = "active";
        user.currentPlan = "starter";

        if (subscription.current_start) {
          user.subscriptionCurrentStart =
            new Date(
              subscription.current_start * 1000
            );
        }

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(
              subscription.current_end * 1000
            );

          user.planEndDate =
            user.subscriptionCurrentEnd;
        }

        await user.save();

        // Razorpay's subscription.charged event
        // may contain the payment entity.
        const chargedPayment =
          event.payload?.payment?.entity;

        if (chargedPayment) {
          const existingPayment =
            await Payment.findOne({
              razorpayPaymentId:
                chargedPayment.id,
            });

          if (!existingPayment) {
            await Payment.create({
              userId: user._id,

              razorpayPaymentId:
                chargedPayment.id,

              razorpaySubscriptionId:
                subscription.id,

              amount:
                chargedPayment.amount
                  ? chargedPayment.amount / 100
                  : 99,

              currency:
                chargedPayment.currency || "INR",

              status: "captured",

              eventType:
                "subscription.charged",

              webhookEventId: eventId,

              paidAt: chargedPayment.created_at
                ? new Date(
                    chargedPayment.created_at *
                      1000
                  )
                : new Date(),
            });
          }
        }

        console.log(
          "💰 SUBSCRIPTION CHARGED:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 8. SUBSCRIPTION PENDING
    // ==========================================

    if (
      eventType ===
        "subscription.pending" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus =
          "past_due";

        await user.save();

        console.log(
          "⚠️ SUBSCRIPTION PENDING:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 9. PAYMENT CAPTURED
    // ==========================================

    if (
      eventType === "payment.captured" &&
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
          /*
           * Do NOT blindly use payment.captured
           * to activate the subscription.
           *
           * subscription.activated /
           * subscription.charged are the subscription
           * lifecycle events we use for entitlement.
           */

          const existingPayment =
            await Payment.findOne({
              razorpayPaymentId:
                payment.id,
            });

          if (!existingPayment) {
            await Payment.create({
              userId: user._id,

              razorpayPaymentId:
                payment.id,

              razorpaySubscriptionId:
                subscriptionId,

              amount:
                payment.amount
                  ? payment.amount / 100
                  : 0,

              currency:
                payment.currency || "INR",

              status: "captured",

              eventType:
                "payment.captured",

              webhookEventId: eventId,

              paidAt: payment.created_at
                ? new Date(
                    payment.created_at * 1000
                  )
                : new Date(),
            });
          }

          console.log(
            "💳 PAYMENT CAPTURED:",
            payment.id
          );
        }
      }
    }

    // ==========================================
    // 10. PAYMENT FAILED
    // ==========================================

    if (
      eventType === "payment.failed" &&
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

          const existingPayment =
            await Payment.findOne({
              razorpayPaymentId:
                payment.id,
            });

          if (!existingPayment) {
            await Payment.create({
              userId: user._id,

              razorpayPaymentId:
                payment.id,

              razorpaySubscriptionId:
                subscriptionId,

              amount:
                payment.amount
                  ? payment.amount / 100
                  : 0,

              currency:
                payment.currency || "INR",

              status: "failed",

              eventType:
                "payment.failed",

              webhookEventId: eventId,

              paidAt: null,
            });
          }

          console.log(
            "❌ PAYMENT FAILED:",
            payment.id
          );
        }
      }
    }

    // ==========================================
    // 11. SUBSCRIPTION HALTED
    // ==========================================

    if (
      eventType ===
        "subscription.halted" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus =
          "halted";

        /*
         * Keep the current period information.
         * Entitlement logic will determine whether
         * access has actually expired.
         */

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(
              subscription.current_end * 1000
            );

          user.planEndDate =
            user.subscriptionCurrentEnd;
        }

        await user.save();

        console.log(
          "⛔ SUBSCRIPTION HALTED:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 12. SUBSCRIPTION CANCELLED
    // ==========================================

    if (
      eventType ===
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

        /*
         * IMPORTANT:
         *
         * Cancellation does NOT automatically
         * remove access.
         *
         * The user should retain access until
         * current_end / planEndDate.
         */

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(
              subscription.current_end * 1000
            );

          user.planEndDate =
            user.subscriptionCurrentEnd;
        }

        await user.save();

        console.log(
          "🚫 SUBSCRIPTION CANCELLED:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 13. SUBSCRIPTION COMPLETED
    // ==========================================

    if (
      eventType ===
        "subscription.completed" &&
      subscription
    ) {
      const user = await User.findOne({
        razorpaySubscriptionId:
          subscription.id,
      });

      if (user) {
        user.subscriptionStatus =
          "expired";

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(
              subscription.current_end * 1000
            );

          user.planEndDate =
            user.subscriptionCurrentEnd;
        }

        await user.save();

        console.log(
          "🏁 SUBSCRIPTION COMPLETED:",
          subscription.id
        );
      }
    }

    // ==========================================
    // 14. MARK WEBHOOK PROCESSED
    // ==========================================

    try {
      await WebhookEvent.create({
        eventId,
        eventType,
      });
    } catch (idempotencyError) {
      /*
       * If another webhook worker/request already
       * inserted this event, MongoDB's unique index
       * prevents a duplicate.
       *
       * The actual payment record is additionally
       * protected by razorpayPaymentId.
       */

      if (
        idempotencyError.code !== 11000
      ) {
        throw idempotencyError;
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
      message:
        "Webhook processing failed",
    });
  }
};

module.exports = {
  handleRazorpayWebhook,
};