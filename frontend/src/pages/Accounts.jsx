import { useEffect, useState } from "react";
import api from "../services/api";
import DashboardLayout from "../components/DashboardLayout";

function Accounts() {

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
  <h1>Instagram Accounts</h1>

  {loading ? (
    <p>Loading...</p>
  ) : accounts.length === 0 ? (
    <div
      style={{
        border: "1px solid #e5e7eb",
        padding: "20px",
        borderRadius: "12px",
        marginTop: "20px",
      }}
    >
      <h3>No Instagram Account Connected</h3>

      <button
        style={{
          padding: "12px 20px",
          border: "none",
          borderRadius: "10px",
          color: "white",
          background:
            "linear-gradient(135deg, #E1306C, #833AB4)",
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
          border: "1px solid #e5e7eb",
          padding: "20px",
          borderRadius: "12px",
          marginTop: "20px",
        }}
      >
        <h3>@{account.username}</h3>

        <p>Status: {account.status}</p>

        <p>
          Connected:{" "}
          {new Date(
            account.connectedAt
          ).toLocaleDateString()}
        </p>

        <button
          style={{
            padding: "10px 18px",
            border: "none",
            borderRadius: "10px",
            color: "white",
            background: "#ef4444",
          }}
        >
          Disconnect
        </button>
      </div>
    ))
  )}

    </DashboardLayout>
  );
}

export default Accounts;