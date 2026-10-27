import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Bot,
  CircleUserRound,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { to: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { to: "/automations", label: "Automations", Icon: Bot },
  { to: "/accounts", label: "Instagram Accounts", Icon: CircleUserRound },
  { to: "/billing", label: "Billing", Icon: CreditCard },
  { to: "/settings", label: "Settings", Icon: Settings },
];

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
    `group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
      location.pathname === path
        ? "bg-[#302451] text-[#c5b2ff]"
        : "text-[#a5a2b7] hover:bg-[#201c31] hover:text-[#eee8ff]"
    }`;

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
            className={navItemClass(to)}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
              active
                ? "bg-[#7655db] text-white shadow-sm"
                : "text-[#a5a2b7] group-hover:text-white"
            }`}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#29283d] bg-[#151522] px-4 py-3 text-sm font-semibold text-[#aaa6bb] transition hover:border-[#7655db] hover:bg-[#211b35] hover:text-white"
    >
      <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />
      Log out
    </button>
  );

  return (
    <div className="tdm-workspace flex min-h-screen min-w-0 flex-col bg-[#10111b] text-[#f7f5ff] md:flex-row">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#28263a] bg-[#10111b] px-4 py-3 md:hidden">
        <Link to="/dashboard" aria-label="TriggerDM overview" className="text-2xl font-extrabold tracking-tight text-[#191724]">
          Trigger<span className="text-[#7655db]">DM</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#302d45] bg-[#171725] text-[#aaa6bb] transition hover:bg-[#211b35]"
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#28263a] bg-[#131420] px-4 py-6 md:flex lg:w-64 lg:px-5">
        <Link to="/dashboard" aria-label="TriggerDM overview" className="mb-9 px-2 text-[25px] font-extrabold tracking-[-0.05em] text-slate-950">
          Trigger<span className="text-[#a98aff]">DM</span>
        </Link>
        {renderNavigation()}
        <div className="flex-1" />
        <div className="mt-8 border-t border-[#e9e4eb] pt-5">{logoutButton}</div>
      </aside>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(82vw,320px)] flex-col border-l border-[#28263a] bg-[#131420] px-5 py-6 shadow-2xl md:hidden">
            <div className="mb-8 flex items-center justify-between">
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold tracking-tight text-slate-950">
                Trigger<span className="text-violet-600">DM</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777280] transition hover:bg-[#f3efff]"
              >
                <X size={21} />
              </button>
            </div>
            {renderNavigation(true)}
            <div className="flex-1" />
            <div className="mt-8 border-t border-[#28263a] pt-5">{logoutButton}</div>
          </aside>
        </>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 hidden h-[74px] items-center justify-end border-b border-[#28263a] bg-[#10111b]/95 px-6 backdrop-blur sm:px-8 md:flex lg:px-10">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7655db] text-sm font-semibold text-white">W</span>
            <span><span className="block text-sm font-semibold text-white">Workspace</span><span className="block text-xs text-[#a5a2b7]">TriggerDM account</span></span>
            <ChevronDown size={15} className="text-[#a5a2b7]" />
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">{children}</div>
      </main>
    </div>
  );
}

export default DashboardLayout;
