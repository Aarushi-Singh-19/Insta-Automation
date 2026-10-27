import { useEffect, useState } from "react";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import {
  User,
  CreditCard,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react";

function Settings() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get("/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data.user);
      })
      .catch((error) => {
        console.error("Failed to load settings profile:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardStyle = {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: "18px",
    padding: "26px",
    marginTop: "20px",
    boxShadow: "0 2px 10px rgba(31, 20, 65, 0.035)",
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
            <div style={valueStyle}>{user?.name || "Loading..."}</div>
          </div>

          <div>
            <div style={labelStyle}>Email Address</div>
            <div style={valueStyle}>{user?.email || "Loading..."}</div>
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
           <BadgeCheck size={21} color="#7C5CE0" />
            <h2 style={{ margin: 0 }}>Instagram Account</h2>
          </div>

          <span
            style={{
              background: "#F0FDF4",
              color: "#287D4D",
              border: "1px solid #D8F0E0",
              padding: "7px 12px",
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
            padding: "11px 16px",
            border: "1px solid #E3DDF7",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#F5F1FF",
            color: "#6941C6",
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
            padding: "7px 12px",
            background: "#F5F1FF",
            color: "#6941C6",
            border: "1px solid #E6DFFD",
            borderRadius: "999px",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "20px",
          }}
        >
          Trial Plan
        </div>

        <br />

        <button
          style={{
            padding: "11px 16px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#7654DE",
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
          border: "1px solid #F0E1E5",
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
          <ShieldAlert size={21} color="#C75B70" />
          <h2
            style={{
              margin: 0,
              color: "#9F3D52",
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
            padding: "11px 16px",
            border: "1px solid #F0D8DE",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#FFF5F6",
            color: "#A33F53",
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