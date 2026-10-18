
const crypto = require("crypto");

const User = require("../models/User");
const Payment = require("../models/Payment");
const WebhookEvent = require("../models/WebhookEvent");

const handleRazorpayWebhook = async (req, res) => {
  let eventId;

  try {
    // 1. Validate request body and signature
    const webhookSignature =
      req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay webhook signature",
      });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Expected raw webhook body",
      });
    }

    const rawBody = req.body;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
      return res.status(500).json({
        success: false,
        message: "Webhook configuration error",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest();

    const suppliedSignature = String(webhookSignature);

    if (
      !/^[a-fA-F0-9]{64}$/.test(suppliedSignature) ||
      !crypto.timingSafeEqual(
        expectedSignature,
        Buffer.from(suppliedSignature, "hex")
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // 2. Parse event
    const event = JSON.parse(rawBody.toString("utf8"));
    eventId = req.headers["x-razorpay-event-id"] || event.id;
    const eventType = event.event;

    if (!eventId || !eventType) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay webhook payload",
      });
    }

    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;

    // 3. Claim the event. Unique eventId prevents duplicate claims.
    const now = new Date();
    const leaseMs = 2 * 60 * 1000;

    try {
      const existingEvent = await WebhookEvent.findOne({ eventId });

      if (existingEvent) {
        if (
          !existingEvent.status ||
          existingEvent.status === "processed"
        ) {
          return res.status(200).json({
            success: true,
            duplicate: true,
          });
        }

        if (
          existingEvent.status === "processing" &&
          existingEvent.lockedUntil &&
          existingEvent.lockedUntil > now
        ) {
          return res.status(503).json({
            success: false,
            message: "Webhook is already being processed",
          });
        }

        const claimed = await WebhookEvent.findOneAndUpdate(
          {
            eventId,
            status: existingEvent.status,
          },
          {
            $set: {
              eventType,
              status: "processing",
              lockedUntil: new Date(now.getTime() + leaseMs),
              lastError: null,
            },
            $inc: { attempts: 1 },
          },
          { new: true }
        );

        if (!claimed) {
          return res.status(503).json({
            success: false,
            message: "Could not claim webhook for processing",
          });
        }
      } else {
        await WebhookEvent.create({
          eventId,
          eventType,
          status: "processing",
          lockedUntil: new Date(now.getTime() + leaseMs),
          attempts: 1,
        });
      }
    } catch (claimError) {
      if (claimError.code === 11000) {
        return res.status(503).json({
          success: false,
          message: "Webhook is already being processed; retry later",
        });
      }
      throw claimError;
    }

    // Helper: record a payment only once per Razorpay payment ID.
    const recordPayment = async ({
      user,
      paymentEntity,
      subscriptionId,
      status,
      type,
    }) => {
      if (
        !user ||
        !paymentEntity?.id ||
        !Number.isFinite(paymentEntity.amount) ||
        paymentEntity.amount < 0
      ) {
        return;
      }

      try {
        await Payment.updateOne(
          { razorpayPaymentId: paymentEntity.id },
          {
            $setOnInsert: {
              userId: user._id,
              razorpayPaymentId: paymentEntity.id,
              razorpaySubscriptionId: subscriptionId || null,
              amount: paymentEntity.amount / 100,
              currency: paymentEntity.currency || "INR",
              status,
              eventType: type,
              webhookEventId: eventId,
              paidAt:
                status === "captured" && paymentEntity.created_at
                  ? new Date(paymentEntity.created_at * 1000)
                  : null,
            },
          },
          { upsert: true }
        );
      } catch (error) {
        // A concurrent event can insert the same payment first.
        if (error.code !== 11000) throw error;
      }
    };

    // 4. Subscription authenticated: do not grant paid access.
    if (eventType === "subscription.authenticated" && subscription) {
      console.log("SUBSCRIPTION AUTHENTICATED:", subscription.id);
    }

    // 5. Subscription activated
    if (eventType === "subscription.activated" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "active";
        user.currentPlan = "starter";

        user.subscriptionCurrentStart = subscription.current_start
          ? new Date(subscription.current_start * 1000)
          : null;

        user.subscriptionCurrentEnd = subscription.current_end
          ? new Date(subscription.current_end * 1000)
          : null;

        user.planEndDate = user.subscriptionCurrentEnd;
        await user.save();
      }
    }

    // 6. Successful subscription charge
    if (eventType === "subscription.charged" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "active";
        user.currentPlan = "starter";

        if (subscription.current_start) {
          user.subscriptionCurrentStart =
            new Date(subscription.current_start * 1000);
        }

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(subscription.current_end * 1000);
          user.planEndDate = user.subscriptionCurrentEnd;
        }

        await user.save();

        await recordPayment({
          user,
          paymentEntity: payment,
          subscriptionId: subscription.id,
          status: "captured",
          type: "subscription.charged",
        });
      }
    }

    // 7. Subscription pending
    if (eventType === "subscription.pending" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "past_due";
        await user.save();
      }
    }

    // 8. Payment captured. This records payment history only;
    // subscription lifecycle events control subscription access.
    if (eventType === "payment.captured" && payment?.subscription_id) {
      const user = await User.findOne({
        razorpaySubscriptionId: payment.subscription_id,
      });

      if (user) {
        await recordPayment({
          user,
          paymentEntity: payment,
          subscriptionId: payment.subscription_id,
          status: "captured",
          type: "payment.captured",
        });
      }
    }

    // 9. Payment failed
    if (eventType === "payment.failed" && payment?.subscription_id) {
      const user = await User.findOne({
        razorpaySubscriptionId: payment.subscription_id,
      });

      if (user) {
        user.subscriptionStatus = "past_due";
        await user.save();

        await recordPayment({
          user,
          paymentEntity: payment,
          subscriptionId: payment.subscription_id,
          status: "failed",
          type: "payment.failed",
        });
      }
    }

    // 10. Subscription halted
    if (eventType === "subscription.halted" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "halted";

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(subscription.current_end * 1000);
          user.planEndDate = user.subscriptionCurrentEnd;
        }

        await user.save();
      }
    }

    // 11. Subscription cancelled: retain access until period end
    if (eventType === "subscription.cancelled" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "cancelled";

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(subscription.current_end * 1000);
          user.planEndDate = user.subscriptionCurrentEnd;
        }

        await user.save();
      }
    }

    // 12. Subscription completed
    if (eventType === "subscription.completed" && subscription) {
      const user = await User.findOne({
        razorpaySubscriptionId: subscription.id,
      });

      if (user) {
        user.subscriptionStatus = "expired";

        if (subscription.current_end) {
          user.subscriptionCurrentEnd =
            new Date(subscription.current_end * 1000);
          user.planEndDate = user.subscriptionCurrentEnd;
        }

        await user.save();
      }
    }

    // 13. Mark event processed
    await WebhookEvent.findOneAndUpdate(
      { eventId, status: "processing" },
      {
        $set: {
          status: "processed",
          processedAt: new Date(),
          lockedUntil: null,
          lastError: null,
        },
      }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("RAZORPAY WEBHOOK ERROR:", error);

    if (eventId) {
      try {
        await WebhookEvent.findOneAndUpdate(
          { eventId, status: "processing" },
          {
            $set: {
              status: "failed",
              lockedUntil: null,
              lastError: String(error.message || error).slice(0, 1000),
            },
          }
        );
      } catch (markError) {
        console.error("FAILED TO MARK WEBHOOK FOR RETRY:", markError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = { handleRazorpayWebhook };
