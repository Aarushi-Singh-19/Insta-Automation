import DashboardLayout from "../components/DashboardLayout";
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
      <h1>Billing & Subscription</h1>

      <p style={{ color: "#6b7280" }}>
        Manage your TriggerDM subscription.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginTop: "30px",
        }}
      >
        {/* Current Plan */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            padding: "24px",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <h2>Current Plan</h2>

          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              background: "#F59E0B",
              color: "white",
              borderRadius: "999px",
              fontSize: "12px",
              marginTop: "10px",
            }}
          >
            {user?.currentPlan}
          </div>

{user?.subscriptionStatus === "trial" && (
  <p style={{ marginTop: "20px" }}>
    You are currently on the free trial.
  </p>
)}

{user?.subscriptionStatus === "active" && (
  <p style={{ marginTop: "20px", color: "green" }}>
    Subscription Active ✅
  </p>
)}

{user?.subscriptionStatus === "expired" && (
  <p style={{ marginTop: "20px", color: "red" }}>
    Subscription Expired
  </p>
)}

{user?.subscriptionStatus === "trial" && (
  <p>
    <strong>Days Remaining:</strong> {daysRemaining}
  </p>
)}

{user?.subscriptionStatus === "active" && (
  <p>
    <strong>Valid Until:</strong>{" "}
    {new Date(user.planEndDate).toLocaleDateString()}
  </p>
)}
        </div>

        {/* Starter Plan */}
        <div
          style={{
            border: "2px solid #E1306C",
            padding: "24px",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <h2>Starter Plan</h2>

          <h1
            style={{
              marginTop: "10px",
              marginBottom: "20px",
            }}
          >
            ₹199/month
          </h1>

          <ul
            style={{
              lineHeight: "2",
              paddingLeft: "20px",
            }}
          >
            <li>1 Instagram Account</li>
            <li>Unlimited Campaigns</li>
            <li>Unlimited Rules</li>
            <li>Comment Automation</li>
            <li>DM Automation</li>
          </ul>
{user?.subscriptionStatus !== "active" && (
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
              const verifyRes = await API.post(
                "/billing/verify-payment",
                {
                  razorpay_order_id:
                    response.razorpay_order_id,
                  razorpay_payment_id:
                    response.razorpay_payment_id,
                  razorpay_signature:
                    response.razorpay_signature,
                }
              );

              console.log(
                "Verify Response:",
                verifyRes.data
              );

              const userRes = await API.get("/auth/me");

              setUser(userRes.data.user);

              alert(
                "Subscription Activated Successfully"
              );
            } catch (error) {
              console.log(error);
            }
          },

          theme: {
            color: "#E1306C",
          },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.open();
      } catch (error) {
        console.log(error);
      }
    }}
    style={{
      marginTop: "20px",
      padding: "12px 20px",
      border: "none",
      borderRadius: "10px",
      color: "white",
      cursor: "pointer",
      background:
        "linear-gradient(135deg, #E1306C, #833AB4)",
    }}
  >
    Upgrade Now
  </button>
)}

{user?.subscriptionStatus === "active" && (
  <div
    style={{
      marginTop: "20px",
      padding: "12px",
      borderRadius: "10px",
      background: "#DCFCE7",
      color: "#166534",
      fontWeight: "600",
      textAlign: "center",
    }}
  >
    Current Plan Active ✅
  </div>
)}

        </div> {/* Starter Plan card */}

      </div> {/* Grid */}
    </DashboardLayout>
  );
}

export default Billing;