import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  CircleUserRound,
  CreditCard,
  Settings,
  LogOut,
} from "lucide-react";

function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const navItemStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 600,
    color: location.pathname === path ? "#7C3AED" : "#374151",
    background:
      location.pathname === path ? "#F3E8FF" : "transparent",
    transition: "all 0.2s ease",
  });

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F8FAFC",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "260px",
          background: "#fff",
          borderRight: "1px solid #E5E7EB",
          padding: "28px 22px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: "40px",
            fontSize: "30px",
            fontWeight: "800",
            background:
              "linear-gradient(135deg,#E1306C,#833AB4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TriggerDM
        </h1>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <Link to="/dashboard" style={navItemStyle("/dashboard")}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <Link to="/automations" style={navItemStyle("/automations")}>
            <Bot size={18} />
            <span>Automations</span>
          </Link>

          <Link to="/accounts" style={navItemStyle("/accounts")}>
            <CircleUserRound size={18} />
            <span>Instagram Accounts</span>
          </Link>

          <Link to="/billing" style={navItemStyle("/billing")}>
            <CreditCard size={18} />
            <span>Billing</span>
          </Link>

          <Link to="/settings" style={navItemStyle("/settings")}>
            <Settings size={18} />
            <span>Settings</span>
          </Link>
        </nav>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            border: "none",
            borderRadius: "12px",
            background:
              "linear-gradient(135deg,#E1306C,#833AB4)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: "600",
            transition: "all 0.2s ease",
          }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "40px",
          overflowY: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;