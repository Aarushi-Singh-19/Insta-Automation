import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import {
  User,
  CreditCard,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react";

function Settings() {
  const cardStyle = {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: "20px",
    padding: "28px",
    marginTop: "24px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
  };

  const labelStyle = {
    color: "#6B7280",
    fontSize: "14px",
    marginBottom: "6px",
  };

  const valueStyle = {
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences."
      />

      {/* Profile */}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <User size={22} color="#7C3AED" />
          <h2 style={{ margin: 0 }}>Profile</h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: "24px",
          }}
        >
          <div>
            <div style={labelStyle}>Full Name</div>
            <div style={valueStyle}>Test User</div>
          </div>

          <div>
            <div style={labelStyle}>Email Address</div>
            <div style={valueStyle}>test@gmail.com</div>
          </div>
        </div>
      </div>

      {/* Instagram */}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
           <BadgeCheck size={22} color="#E1306C" />
            <h2 style={{ margin: 0 }}>Instagram Account</h2>
          </div>

          <span
            style={{
              background: "#DCFCE7",
              color: "#15803D",
              padding: "8px 14px",
              borderRadius: "999px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ● Connected
          </span>
        </div>

        <div style={labelStyle}>Connection Status</div>

        <div
          style={{
            ...valueStyle,
            marginBottom: "20px",
          }}
        >
          Your Instagram Business account is connected successfully.
        </div>

        <button
          style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            background: "linear-gradient(135deg,#E1306C,#833AB4)",
            color: "#fff",
            fontWeight: "600",
          }}
        >
          Reconnect Instagram
        </button>
      </div>

      {/* Subscription */}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <CreditCard size={22} color="#7C3AED" />
          <h2 style={{ margin: 0 }}>Subscription</h2>
        </div>

        <div style={labelStyle}>Current Plan</div>

        <div
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#FEF3C7",
            color: "#92400E",
            borderRadius: "999px",
            fontWeight: "600",
            marginBottom: "24px",
          }}
        >
          Trial Plan
        </div>

        <br />

        <button
          style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            background: "#F59E0B",
            color: "#fff",
            fontWeight: "600",
          }}
        >
          Upgrade Plan
        </button>
      </div>

      {/* Danger Zone */}

      <div
        style={{
          ...cardStyle,
          border: "1px solid #FECACA",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <ShieldAlert size={22} color="#DC2626" />
          <h2
            style={{
              margin: 0,
              color: "#B91C1C",
            }}
          >
            Danger Zone
          </h2>
        </div>

        <p
          style={{
            color: "#6B7280",
            marginBottom: "20px",
          }}
        >
          Log out of your TriggerDM account on this device.
        </p>

        <button
          style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            background: "#DC2626",
            color: "#fff",
            fontWeight: "600",
          }}
        >
          Logout
        </button>
      </div>
    </DashboardLayout>
  );
}

export default Settings;