
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const Payment = require("../models/Payment");
const WebhookEvent = require("../models/WebhookEvent");
const ReferralEarning = require("../models/ReferralEarning");
const ReferralRefundRecord = require("../models/ReferralRefundRecord");
const { calculateRefundCommissionReversal, calculateRecoveryRestore } = require("../services/referralRefundAccounting");
const { recordReferralCommission } = require("../services/referralCommission");

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
    const refund = event.payload?.refund?.entity;

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

        // Commission logic is isolated and unit-tested. The payment ID unique index
        // plus $setOnInsert makes repeated events idempotent.
        await recordReferralCommission({
          ReferralEarning,
          user,
          payment,
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

    // Proportionally reverse referral commission for each unique processed refund.
    // A commission already paid is retained in paid history and the recovery amount
    // is tracked separately; it is never silently erased.
    if (eventType === "refund.processed" && refund?.payment_id && refund?.id &&
        Number.isFinite(refund.amount) && refund.amount > 0) {
      const existingRefund = await ReferralRefundRecord.findOne({ razorpayRefundId: refund.id }).lean();
      if (!existingRefund) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const earning = await ReferralEarning.findOne({
              razorpayPaymentId: refund.payment_id
            }).session(session);
            if (!earning) {
              throw new Error("Refund commission earning not found; retry webhook later");
            }

            const originalCommission = Number(
              earning.originalCommissionAmount ?? earning.commissionAmount
            );
            const grossAmount = Number(earning.grossAmount);
            if (!(originalCommission >= 0) || !(grossAmount > 0)) return;

            const refundAmount = refund.amount / 100;
            const { nextRefundedAmount, targetReversal, reversalDelta } =
              calculateRefundCommissionReversal({
                grossAmount,
                originalCommissionAmount: originalCommission,
                previouslyRefundedAmount: Number(earning.refundedAmount || 0),
                previouslyReversedAmount: Number(earning.commissionReversedAmount || 0),
                refundAmount,
              });

            await ReferralRefundRecord.create([{
              razorpayRefundId: refund.id,
              razorpayPaymentId: refund.payment_id,
              amount: refundAmount,
              commissionReversal: reversalDelta
            }], { session });

            const recoveryApplied = Number(earning.recoveryApplied || 0);
            const { targetRecoveryRestore, recoveryRestoreDelta } = calculateRecoveryRestore({
              grossAmount,
              recoveryApplied,
              previouslyRestoredAmount: Number(earning.recoveryAppliedReversedAmount || 0),
              cumulativeRefundAmount: nextRefundedAmount,
            });

            earning.originalCommissionAmount = originalCommission;
            earning.refundedAmount = nextRefundedAmount;
            earning.commissionReversedAmount = targetReversal;
            earning.recoveryAppliedReversedAmount = targetRecoveryRestore;

            if (earning.status === "paid") {
              // The reversal includes both cash previously paid and commission
              // previously used to settle an older recovery. The full delta is
              // owed again and will be offset against future commissions.
              earning.recoveryDue = Number((Number(earning.recoveryDue || 0) + reversalDelta).toFixed(2));
            } else {
              // Restore the portion of an earlier recovery offset that the
              // refund invalidates, and remove only the remaining reversal
              // from this earning's unpaid commission.
              earning.recoveryDue = Number((Number(earning.recoveryDue || 0) + recoveryRestoreDelta).toFixed(2));
              const recoveryStillApplied = Math.max(0, recoveryApplied - targetRecoveryRestore);
              earning.commissionAmount = Math.max(
                0,
                Number((originalCommission - targetReversal - recoveryStillApplied).toFixed(2))
              );
              if (earning.commissionAmount === 0) earning.status = "reversed";
            }
            await earning.save({ session });
          });
        } catch (refundError) {
          // A concurrent delivery of the same refund is harmless due to the
          // unique refund ID; all other failures must be retried by Razorpay.
          if (refundError.code !== 11000) throw refundError;
        } finally {
          await session.endSession();
        }
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
