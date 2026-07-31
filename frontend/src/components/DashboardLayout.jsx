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

  const navItemClass = (path) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
      location.pathname === path
        ? "bg-purple-100 text-purple-700"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col px-6 py-8 shadow-sm">
        <h1 className="mb-10 text-4xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          TriggerDM
        </h1>

        <nav className="space-y-3">
          <Link to="/dashboard" className={navItemClass("/dashboard")}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>

          <Link to="/automations" className={navItemClass("/automations")}>
            <Bot size={20} />
            Automations
          </Link>

          <Link to="/accounts" className={navItemClass("/accounts")}>
            <CircleUserRound size={20} />
            Instagram Accounts
          </Link>

          <Link to="/billing" className={navItemClass("/billing")}>
            <CreditCard size={20} />
            Billing
          </Link>

          <Link to="/settings" className={navItemClass("/settings")}>
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        <div className="flex-1" />

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;