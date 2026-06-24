import DashboardLayout from "../components/DashboardLayout";
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import API from "../services/api";

function Billing() {

  const [user, setUser] = useState(null);

  useEffect(() => {
  fetchUser();
}, []);

const fetchUser = async () => {
  try {
    const res = await API.get("/auth/me");
    setUser(res.data.user);
  } catch (error) {
    console.log(error);
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

          <p style={{ marginTop: "20px" }}>
            You are currently on the free trial.
          </p>

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

          <button
            onClick={async () => {
  try {
    await API.post("/billing/activate-test");

    const res = await API.get("/auth/me");

    setUser(res.data.user);

    alert("Plan upgraded successfully");
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
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Billing;