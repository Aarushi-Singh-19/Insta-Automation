import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import TrialBanner from "../components/ui/TrialBanner";
import { Bot, MessageCircle, KeyRound, CircleUserRound, CheckCircle2, Clock3, XCircle } from "lucide-react";

const number = (value) => Number(value || 0).toLocaleString("en-IN");

function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    activeAutomations: 0, dmsSent: 0, commentsProcessed: 0, connectedAccounts: 0,
  });
  const [delivery, setDelivery] = useState({ success: 0, queued: 0, failed: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUser();
    fetchDashboardStats();
    fetchDeliveryStats();
  }, []);

  const handleCreateAutomation = async () => {
    try {
      const response = await API.get("/instagram/accounts");
      const accounts = response.data?.data || [];
      if (!accounts.some((account) => account.status === "active")) {
        navigate("/accounts", { state: { connectRequired: true } });
        return;
      }
      navigate("/automations");
    } catch (error) {
      console.error("Unable to verify Instagram connection:", error);
      alert("We could not verify your Instagram connection. Please try again.");
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await API.get("/analytics/dashboard");
      setStats(response.data);
    } catch (error) {
      console.error("Dashboard statistics error:", error);
    } finally {
      setStatsLoaded(true);
    }
  };

  const fetchDeliveryStats = async () => {
    try {
      const response = await API.get("/analytics/trends");
      setDelivery({
        success: Number(response.data?.success || 0),
        queued: Number(response.data?.queued || 0),
        failed: Number(response.data?.failed || 0),
      });
    } catch (error) {
      console.error("Delivery statistics error:", error);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await API.get("/auth/me");
      setUser(response.data.user);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const totalEvents = delivery.success + delivery.queued + delivery.failed;
  const maxDelivery = Math.max(delivery.success, delivery.queued, delivery.failed, 1);
  const daysRemaining = user?.trialEndDate
    ? Math.max(0, Math.ceil((new Date(user.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Welcome back"
        subtitle="A clear view of your Instagram comment-to-DM automations."
        action={
          <button onClick={handleCreateAutomation}
            className="rounded-lg bg-[#7655db] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(118,85,219,0.18)] transition hover:-translate-y-0.5 hover:bg-[#6746cc]">
            + Create Automation
          </button>
        }
      />

      {user?.subscriptionStatus === "trial" && (
        <TrialBanner daysRemaining={daysRemaining} onUpgrade={() => navigate("/billing")} />
      )}

      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard title="Active Automations" value={statsLoaded ? number(stats.activeAutomations) : "—"} icon={<Bot size={22} />} />
        <StatCard title="DMs Sent" value={statsLoaded ? number(stats.dmsSent) : "—"} icon={<MessageCircle size={22} />} />
        <StatCard title="Comments Processed" value={statsLoaded ? number(stats.commentsProcessed) : "—"} icon={<KeyRound size={22} />} />
        <StatCard title="Instagram Accounts" value={statsLoaded ? number(stats.connectedAccounts) : "—"} icon={<CircleUserRound size={22} />} />
      </div>

      <section className="mt-7 rounded-2xl border border-[#e7e2ef] bg-white p-5 shadow-[0_2px_8px_rgba(34,25,57,0.025)] sm:p-7" aria-labelledby="delivery-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="delivery-title" className="text-lg font-semibold tracking-tight text-[#201a32]">Delivery activity</h2>
            <p className="mt-1 text-sm text-[#777187]">Live totals from your recorded automation events.</p>
          </div>
          <span className="rounded-full border border-[#e7e2ef] bg-[#faf9fd] px-3 py-1 text-xs text-[#777187]">{number(totalEvents)} recorded events</span>
        </div>

        <div className="mt-7 space-y-5">
          {[
            { label: "Delivered successfully", value: delivery.success, Icon: CheckCircle2, color: "#7655db", bg: "#eee8ff" },
            { label: "Queued", value: delivery.queued, Icon: Clock3, color: "#9a80d9", bg: "#f3efff" },
            { label: "Failed", value: delivery.failed, Icon: XCircle, color: "#b66b86", bg: "#f9edf2" },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-[#625b70]"><Icon size={16} style={{ color }} />{label}</span>
                <strong className="font-semibold text-[#201a32]">{number(value)}</strong>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#f1eef7]">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value ? Math.max(2, (value / maxDelivery) * 100) : 0}%`, backgroundColor: color, background: bg === "#eee8ff" ? "linear-gradient(90deg,#b9a3ff,#7655db)" : color }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-[#eee9f3] pt-4 text-xs leading-5 text-[#8a8298]">
          Counts reflect the event records currently stored for your account; this panel does not generate sample activity.
        </p>
      </section>
    </DashboardLayout>
  );
}

export default Dashboard;
