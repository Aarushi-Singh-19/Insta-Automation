import { useEffect, useState } from "react";
import api from "../services/api";
import DashboardLayout from "../components/DashboardLayout";

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
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          marginBottom: "25px",
          fontSize: "32px",
          fontWeight: "700",
        }}
      >
        Instagram Accounts
      </h1>

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
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "40px",
            textAlign: "center",
            background: "#fff",
          }}
        >
          <div
            style={{
              fontSize: "55px",
              marginBottom: "15px",
            }}
          >
            📷
          </div>

          <h2
            style={{
              marginBottom: "10px",
            }}
          >
            Connect your Instagram Account
          </h2>

          <p
            style={{
              color: "#6b7280",
              marginBottom: "25px",
              lineHeight: "1.6",
            }}
          >
            Connect your Instagram Business account to start
            automating comment replies and direct messages.
          </p>

          <button
            onClick={connectInstagram}
            style={{
              padding: "14px 24px",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontWeight: "600",
              fontSize: "15px",
              cursor: "pointer",
              background:
                "linear-gradient(135deg,#E1306C,#833AB4)",
            }}
          >
            Connect Instagram
          </button>
        </div>
      ) : (
        accounts.map((account) => (
          <div
            key={account._id}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "20px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "22px",
                  }}
                >
                  📸 @{account.username}
                </h2>

                <p
                  style={{
                    marginTop: "10px",
                    color: "#16a34a",
                    fontWeight: "600",
                  }}
                >
                  ● {account.status}
                </p>

                <p
                  style={{
                    color: "#6b7280",
                  }}
                >
                  Connected on{" "}
                  {new Date(
                    account.connectedAt
                  ).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() =>
                  disconnectInstagram(account._id)
                }
                style={{
                  padding: "12px 20px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#ef4444",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
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