import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, CircleUserRound, CreditCard, Settings,
  LogOut, ChevronDown, Menu, X, Zap,
} from "lucide-react";

const navigation = [
  { to: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { to: "/automations", label: "Automations", Icon: InstagramSidebarIcon },
  { to: "/accounts", label: "Instagram Accounts", Icon: CircleUserRound },
  { to: "/billing", label: "Billing", Icon: CreditCard },
  { to: "/settings", label: "Settings", Icon: Settings },
];

function InstagramSidebarIcon({ size = 19, strokeWidth = 1.9, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DashboardLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  const brand = (
    <span className="inline-flex items-center gap-2.5 text-[25px] font-extrabold tracking-[-0.055em] text-[#191724]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7655db] text-white shadow-sm">
        <Zap size={21} fill="currentColor" strokeWidth={1.8} />
      </span>
      <span>Trigger<span className="text-[#7655db]">DM</span></span>
    </span>
  );

  const renderNavigation = (mobile = false) => (
    <nav aria-label="Main navigation" className="space-y-1.5">
      {navigation.map(({ to, label, Icon }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-[46px] items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-all duration-150 ${
              active
                ? "bg-[#eee8ff] text-[#7655db] shadow-sm"
                : "text-[#777280] hover:bg-[#f2edff] hover:text-[#191724]"
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
              active
                ? "bg-[#7655db] text-white shadow-sm"
                : "bg-transparent text-[#8b8498] group-hover:bg-white group-hover:text-[#7655db]"
            }`}>
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="truncate">{label}</span>
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7655db]" />}
          </Link>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#e9e4eb] bg-white px-4 py-3 text-sm font-semibold text-[#777280] transition hover:border-[#cfc0ff] hover:bg-[#f8f5ff] hover:text-[#7655db]"
    >
      <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />
      Log out
    </button>
  );

  const sidebar = (mobile = false) => (
    <>
      <Link
        to="/dashboard"
        onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
        aria-label="TriggerDM overview"
        className="mb-8 block px-1"
      >
        {brand}
      </Link>
      <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a19aaa]">
        Workspace
      </div>
      {renderNavigation(mobile)}
      <div className="flex-1" />
      <div className="mt-8 border-t border-[#e9e4eb] pt-5">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#f2efff] px-3 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7655db] text-sm font-bold text-white">W</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#191724]">Workspace</span>
            <span className="block truncate text-xs text-[#777280]">TriggerDM account</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-[#8b8498]" />
        </div>
        {logoutButton}
      </div>
    </>
  );

  return (
    <div className="tdm-workspace-light flex min-h-screen min-w-0 flex-col bg-[#f2efff] text-[#191724] md:flex-row">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e9e4eb] bg-[#faf9f6] px-4 py-3 md:hidden">
        <Link to="/dashboard" aria-label="TriggerDM overview">{brand}</Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e9e4eb] bg-white text-[#777280] hover:bg-[#f5f1ff]"
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[#e9e4eb] bg-[#faf9f6] px-4 py-6 md:flex xl:w-[244px]">
        {sidebar()}
      </aside>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-[#191724]/20 md:hidden"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(84vw,330px)] flex-col border-l border-[#e9e4eb] bg-[#faf9f6] px-5 py-6 shadow-2xl md:hidden">
            <div className="mb-8 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777280] hover:bg-[#f3efff]"
              >
                <X size={21} />
              </button>
            </div>
            {sidebar(true)}
          </aside>
        </>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 hidden h-[74px] items-center justify-end border-b border-[#e9e4eb] bg-[#faf9f6]/95 px-6 backdrop-blur sm:px-8 md:flex lg:px-10">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7655db] text-sm font-semibold text-white">W</span>
            <span>
              <span className="block text-sm font-semibold text-[#191724]">Workspace</span>
              <span className="block text-xs text-[#777280]">TriggerDM account</span>
            </span>
            <ChevronDown size={15} className="text-[#8b8498]" />
          </div>
        </header>
        <div className="min-h-[calc(100vh-74px)] bg-[#f2efff] p-4 sm:p-6 lg:p-8 xl:p-10">{children}</div>
      </main>
    </div>
  );
}

export default DashboardLayout;
