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
    <div className="flex min-h-screen min-w-0 flex-col bg-slate-50 md:flex-row">
      {/* Sidebar */}
      <aside className="w-full min-w-0 border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:w-72 md:flex-shrink-0 md:border-b-0 md:border-r md:px-6 md:py-8 md:flex md:flex-col">
        <h1 className="mb-4 text-3xl font-extrabold md:mb-10 md:text-4xl bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          TriggerDM
        </h1>

        <nav className="flex flex-wrap gap-2 md:flex-col md:gap-0 md:space-y-3">
          <Link to="/dashboard" className={`${navItemClass("/dashboard")} px-3 py-2 text-sm md:px-4 md:py-3 md:text-base`}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>

          <Link to="/automations" className={`${navItemClass("/automations")} px-3 py-2 text-sm md:px-4 md:py-3 md:text-base`}>
            <Bot size={20} />
            Automations
          </Link>

          <Link to="/accounts" className={`${navItemClass("/accounts")} px-3 py-2 text-sm md:px-4 md:py-3 md:text-base`}>
            <CircleUserRound size={20} />
            Instagram Accounts
          </Link>

          <Link to="/billing" className={`${navItemClass("/billing")} px-3 py-2 text-sm md:px-4 md:py-3 md:text-base`}>
            <CreditCard size={20} />
            Billing
          </Link>

          <Link to="/settings" className={`${navItemClass("/settings")} px-3 py-2 text-sm md:px-4 md:py-3 md:text-base`}>
            <Settings size={20} />
            Settings
          </Link>
        </nav>

        <div className="hidden flex-1 md:block" />

        <button
          onClick={handleLogout}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90 md:mt-0"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;