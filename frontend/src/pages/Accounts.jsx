import DashboardLayout from "../components/DashboardLayout";

function Accounts() {
  return (
    <DashboardLayout>
      <h1>Instagram Accounts</h1>

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
    </DashboardLayout>
  );
}

export default Accounts;