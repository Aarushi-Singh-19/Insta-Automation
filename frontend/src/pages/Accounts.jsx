import { useEffect, useState } from "react";
import api from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";

function Accounts() {

const connectInstagram = async () => {
  try {
    const res = await api.get("/instagram/connect-v2");

    console.log(res.data);

    if (res.data.success && res.data.authUrl) {
      window.location.href = res.data.authUrl;
    } else {
      alert("Instagram authorization URL not received.");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to connect Instagram.");
  }
};


const disconnectInstagram = async (accountId) => {
  const confirmDisconnect = window.confirm(
    "Are you sure you want to disconnect this Instagram account?"
  );

  if (!confirmDisconnect) return;

  try {
    await api.delete(`/instagram/disconnect/${accountId}`);

    // Remove the account from UI immediately
    setAccounts((prev) =>
      prev.filter((account) => account._id !== accountId)
    );

    alert("Instagram account disconnected successfully.");
  } catch (err) {
    console.error(err);
    alert("Failed to disconnect Instagram.");
  }
};


  const [accounts, setAccounts] = useState([]);
const [loading, setLoading] = useState(true);



useEffect(() => {
  const fetchAccounts = async () => {
    try {
      const res = await api.get(
        "/instagram/accounts"
      );

      setAccounts(res.data.data || []);


    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  fetchAccounts();
}, []);


 return (
  <DashboardLayout>
<div>
<PageHeader
  title="Instagram Accounts"
  subtitle="Connect and manage your Instagram Business accounts."
  action={
    accounts.length > 0 && (
      <button
        onClick={connectInstagram}
        style={{
          padding: "12px 20px",
          border: "none",
          borderRadius: "10px",
          color: "#fff",
          cursor: "pointer",
          background: "linear-gradient(135deg,#E1306C,#833AB4)",
          fontWeight: "600",
        }}
      >
        + Connect Account
      </button>
    )
  }
/>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "250px",
            color: "#6b7280",
            fontSize: "18px",
          }}
        >
          Connecting to Instagram...
        </div>
      ) : accounts.length === 0 ? (
  <div
    style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: "20px",
      padding: "70px 40px",
      textAlign: "center",
      boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
    }}
  >
    <div
      style={{
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        background: "#F3F4F6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 28px",
        fontSize: "42px",
      }}
    >
      📷
    </div>

    <h2
      style={{
        margin: 0,
        fontSize: "30px",
        fontWeight: "700",
        color: "#111827",
      }}
    >
      No Instagram Account Connected
    </h2>

    <p
      style={{
        maxWidth: "520px",
        margin: "18px auto 34px",
        color: "#6B7280",
        lineHeight: "1.7",
        fontSize: "16px",
      }}
    >
      Connect your Instagram Business account to automate
      comment replies, send direct messages, and start
      building powerful engagement workflows with TriggerDM.
    </p>

    <button
      onClick={connectInstagram}
      style={{
        padding: "14px 28px",
        border: "none",
        borderRadius: "12px",
        background:
          "linear-gradient(135deg,#E1306C,#833AB4)",
        color: "#fff",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(131,58,180,.25)",
      }}
    >
      Connect Instagram
    </button>
  </div>
) : (      accounts.map((account) => (
  <div
    key={account._id}
    style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: "20px",
      padding: "28px",
      marginBottom: "20px",
      boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "24px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "#6B7280",
            fontWeight: "500",
          }}
        >
          INSTAGRAM BUSINESS ACCOUNT
        </p>

        <h2
          style={{
            margin: "8px 0 18px",
            fontSize: "28px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          @{account.username}
        </h2>

        <span
          style={{
            display: "inline-block",
            background: "#DCFCE7",
            color: "#15803D",
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "18px",
          }}
        >
          ● {account.status}
        </span>

        <div
          style={{
            marginTop: "6px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#6B7280",
              marginBottom: "4px",
            }}
          >
            Connected On
          </div>

          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "#111827",
            }}
          >
            {new Date(account.connectedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <button
        onClick={() =>
          disconnectInstagram(account._id)
        }
        style={{
          padding: "12px 22px",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          background: "#fff",
          color: "#DC2626",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          transition: "0.2s",
        }}
      >
        Disconnect
      </button>
    </div>
  </div>
))
    )}
    </div>
  </DashboardLayout>
);
}

export default Accounts;