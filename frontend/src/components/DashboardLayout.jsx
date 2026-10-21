import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Bot,
  CircleUserRound,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

function DashboardLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
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
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:hidden">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">TriggerDM</h1>
        <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm">
          {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </header>

      <aside className="hidden w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white px-6 py-8 shadow-sm md:flex">
        <h1 className="mb-10 text-4xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">TriggerDM</h1>
        <nav className="space-y-3">
          <Link to="/dashboard" className={navItemClass("/dashboard")}><LayoutDashboard size={20} />Dashboard</Link>
          <Link to="/automations" className={navItemClass("/automations")}><Bot size={20} />Automations</Link>
          <Link to="/accounts" className={navItemClass("/accounts")}><CircleUserRound size={20} />Instagram Accounts</Link>
          <Link to="/billing" className={navItemClass("/billing")}><CreditCard size={20} />Billing</Link>
          <Link to="/settings" className={navItemClass("/settings")}><Settings size={20} />Settings</Link>
        </nav>
        <div className="flex-1" />
        <button onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90"><LogOut size={18} />Logout</button>
      </aside>

      {mobileMenuOpen && (
        <>
          <button type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/40 md:hidden" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(82vw,320px)] flex-col border-l border-gray-200 bg-white px-5 py-6 shadow-2xl md:hidden">
            <div className="mb-8 flex items-center justify-between">
              <span className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">TriggerDM</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"><X size={22} /></button>
            </div>
            <nav className="space-y-2">
              <Link onClick={() => setMobileMenuOpen(false)} to="/dashboard" className={navItemClass("/dashboard")}><LayoutDashboard size={20} />Dashboard</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/automations" className={navItemClass("/automations")}><Bot size={20} />Automations</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/accounts" className={navItemClass("/accounts")}><CircleUserRound size={20} />Instagram Accounts</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/billing" className={navItemClass("/billing")}><CreditCard size={20} />Billing</Link>
              <Link onClick={() => setMobileMenuOpen(false)} to="/settings" className={navItemClass("/settings")}><Settings size={20} />Settings</Link>
            </nav>
            <div className="flex-1" />
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-semibold text-white transition hover:opacity-90"><LogOut size={18} />Logout</button>
          </aside>
        </>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;