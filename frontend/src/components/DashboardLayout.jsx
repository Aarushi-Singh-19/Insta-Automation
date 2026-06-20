import { Link, useNavigate } from "react-router-dom";

function DashboardLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div
        style={{
          width: "250px",
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          padding: "20px",
          minHeight: "100vh",
        }}
      >
        <h2
          style={{
            background:
              "linear-gradient(135deg, #E1306C, #833AB4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TriggerDM
        </h2>

        <Link to="/dashboard">Overview</Link>
        <br />

        <Link to="/automations">Automations</Link>
        <br />

        <Link to="/accounts">Instagram Accounts</Link>
        <br />

        <Link to="/billing">Billing</Link>
        <br />

        <Link to="/settings">Settings</Link>
        <br /><br />

        <button onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div style={{ flex: 1, padding: "30px" }}>
        {children}
      </div>
    </div>
  );
}

export default DashboardLayout;