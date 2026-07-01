import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import API from "../services/api";

function Billing() {

  const [user, setUser] = useState(null);

  const [payments, setPayments] = useState([]);
const [loadingPayments, setLoadingPayments] = useState(true);
const [paymentError, setPaymentError] = useState("");

useEffect(() => {
  fetchUser();
  fetchPaymentHistory();
}, []);

const fetchUser = async () => {
  try {
    const res = await API.get("/auth/me");
    setUser(res.data.user);
  } catch (error) {
    console.log(error);
  }
};

const fetchPaymentHistory = async () => {
  try {
    setLoadingPayments(true);

    const res = await API.get("/billing/history");

    if (res.data.success) {
      setPayments(res.data.payments);
    }
  } catch (error) {
    console.log(error);
    setPaymentError("Unable to load payment history.");
  } finally {
    setLoadingPayments(false);
  }
};

const daysRemaining = user?.trialEndDate
  ? Math.max(
      0,
      Math.ceil(
        (new Date(user.trialEndDate) - new Date()) /
          (1000 * 60 * 60 * 24)
      )
    )
  : 0;

  return (
    <DashboardLayout>
<PageHeader
  title="Billing & Subscription"
  subtitle="Manage your TriggerDM subscription."
/>




      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginTop: "30px",
        }}
      >
       {/* Current Subscription */}

<div
  style={{
    border: "1px solid #E5E7EB",
    borderRadius: "20px",
    padding: "32px",
    background: "#fff",
    boxShadow: "0 4px 18px rgba(0,0,0,.05)",
  }}
>
  <h2
    style={{
      margin: 0,
      marginBottom: "28px",
      fontSize: "24px",
      fontWeight: "700",
    }}
  >
    Current Subscription
  </h2>

  <span
    style={{
      display: "inline-block",
      padding: "8px 14px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: "600",
      marginBottom: "28px",
      background:
        user?.subscriptionStatus === "active"
          ? "#DCFCE7"
          : "#FEF3C7",
      color:
        user?.subscriptionStatus === "active"
          ? "#166534"
          : "#92400E",
    }}
  >
    {user?.subscriptionStatus === "active"
      ? "✓ Active Subscription"
      : "● Trial"}
  </span>

  <div style={{ marginBottom: "24px" }}>
    <div
      style={{
        color: "#6B7280",
        fontSize: "13px",
        marginBottom: "6px",
      }}
    >
      Current Plan
    </div>

    <div
      style={{
        fontSize: "28px",
        fontWeight: "700",
      }}
    >
      {user?.currentPlan
  ? user.currentPlan.charAt(0).toUpperCase() +
    user.currentPlan.slice(1)
  : "Starter"}
    </div>
  </div>

  {user?.subscriptionStatus === "trial" && (
    <div>
      <div
        style={{
          color: "#6B7280",
          fontSize: "13px",
          marginBottom: "6px",
        }}
      >
        Days Remaining
      </div>

      <div
        style={{
          fontSize: "24px",
          fontWeight: "700",
        }}
      >
        {daysRemaining} days
      </div>
    </div>
  )}

  {user?.subscriptionStatus === "active" && (
    <div>
      <div
        style={{
          color: "#6B7280",
          fontSize: "13px",
          marginBottom: "6px",
        }}
      >
        Valid Until
      </div>

      <div
        style={{
          fontSize: "18px",
          fontWeight: "600",
        }}
      >
        {new Date(user.planEndDate).toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        )}
      </div>
    </div>
  )}
</div>

{/* Starter Plan */}

<div
  style={{
    border: "1px solid #E5E7EB",
    borderRadius: "20px",
    padding: "32px",
    background: "#fff",
    boxShadow: "0 4px 18px rgba(0,0,0,.05)",
    display: "flex",
    flexDirection: "column",
  }}
>
  <div
    style={{
      marginBottom: "28px",
    }}
  >
    <div
      style={{
        color: "#6B7280",
        fontSize: "13px",
        textTransform: "uppercase",
        fontWeight: "600",
        letterSpacing: ".5px",
      }}
    >
      Pricing
    </div>

    <h2
      style={{
        margin: "8px 0",
        fontSize: "28px",
        fontWeight: "700",
      }}
    >
      Starter Plan
    </h2>

    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontSize: "46px",
          fontWeight: "700",
          color: "#111827",
        }}
      >
        ₹199
      </span>

      <span
        style={{
          color: "#6B7280",
          marginBottom: "8px",
          fontSize: "16px",
        }}
      >
        /month
      </span>
    </div>
  </div>

  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      marginBottom: "32px",
      color: "#374151",
      fontSize: "15px",
    }}
  >
    <div>✅ 1 Instagram Business Account</div>
    <div>✅ Unlimited Campaigns</div>
    <div>✅ Unlimited Automation Rules</div>
    <div>✅ Automatic Comment Replies</div>
    <div>✅ Instagram DM Automation</div>
  </div>

  <div style={{ marginTop: "auto" }}>
    {user?.subscriptionStatus !== "active" ? (
      <button
        onClick={async () => {
          try {
            const res = await API.post("/billing/create-order");

            const order = res.data.order;

            const options = {
              key: import.meta.env.VITE_RAZORPAY_KEY_ID,
              amount: order.amount,
              currency: order.currency,
              name: "TriggerDM",
              description: "Starter Plan",
              order_id: order.id,

              handler: async function (response) {
                try {
                  await API.post("/billing/verify-payment", {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  });

                  const userRes = await API.get("/auth/me");
                  setUser(userRes.data.user);

                  alert("Subscription Activated Successfully");
                } catch (error) {
                  console.log(error);
                }
              },

              theme: {
                color: "#E1306C",
              },
            };

            new window.Razorpay(options).open();
          } catch (error) {
            console.log(error);
          }
        }}
        style={{
          width: "100%",
          padding: "15px",
          border: "none",
          borderRadius: "14px",
          background: "linear-gradient(135deg,#E1306C,#833AB4)",
          color: "#fff",
          fontWeight: "700",
          fontSize: "15px",
          cursor: "pointer",
        }}
      >
        Upgrade Now
      </button>
    ) : (
      <div
        style={{
          background: "#F3F4F6",
          color: "#374151",
          textAlign: "center",
          padding: "14px",
          borderRadius: "12px",
          fontWeight: "600",
        }}
      >
        ✓ You're on this plan
      </div>
    )}
  </div>
</div>

        {/* Starter Plan card */}

      </div> {/* Grid */}

<h2
  style={{
    marginTop: "56px",
    marginBottom: "24px",
    fontSize: "30px",
    fontWeight: "700",
  }}
>
  Payment History
</h2>


{loadingPayments && (
  <p style={{ color: "#6b7280" }}>
    Loading payment history...
  </p>
)}

{paymentError && (
  <p style={{ color: "red" }}>
    {paymentError}
  </p>
)}

{!loadingPayments &&
  !paymentError &&
  payments.length === 0 && (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px",
        background: "#fff",
      }}
    >
      No payments found.
    </div>
)}

{!loadingPayments &&
  !paymentError &&
  payments.length > 0 && (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#fff",
        marginTop: "20px",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
          <th style={{ padding: "12px", textAlign: "left" }}>Amount</th>
          <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
          <th style={{ padding: "12px", textAlign: "left" }}>Order ID</th>
        </tr>
      </thead>

      <tbody>
        {payments.map((payment) => (
          <tr
  key={payment._id}
  style={{
    borderBottom: "1px solid #e5e7eb",
  }}
>
            <td style={{ padding: "12px" }}>
              {new Date(payment.createdAt).toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})}
            </td>

            <td style={{ padding: "12px" }}>
              ₹{payment.amount.toFixed(2)}
            </td>

            <td style={{ padding: "12px" }}>
              {payment.status === "success" ? (
<span
  style={{
    background: "#DCFCE7",
    color: "#166534",
    padding: "6px 12px",
    borderRadius: "999px",
    fontWeight: "600",
    fontSize: "13px",
  }}
>
  Success
</span>
              ) : (
 <span
  style={{
    background: "#FEE2E2",
    color: "#991B1B",
    padding: "6px 12px",
    borderRadius: "999px",
    fontWeight: "600",
    fontSize: "13px",
  }}
>
  Failed
</span>
              )}
            </td>

            <td style={{ padding: "12px" }}>
              <span title={payment.orderId}>
  {payment.orderId.length > 18
  ? payment.orderId.slice(0, 18) + "..."
  : payment.orderId}
</span>
            </td>
          </tr>
        ))}
      </tbody>
</table>
</div>
)}
    </DashboardLayout>
  );
}

export default Billing;