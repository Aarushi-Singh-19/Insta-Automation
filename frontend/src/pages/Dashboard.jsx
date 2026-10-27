import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import TrialBanner from "../components/ui/TrialBanner";

import {
  Bot,
  MessageCircle,
  KeyRound,
  CircleUserRound,
} from "lucide-react";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    activeAutomations: 0,
    dmsSent: 0,
    commentsProcessed: 0,
    connectedAccounts: 0,
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchUser();
    fetchDashboardStats();
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

  const daysRemaining = user?.trialEndDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(user.trialEndDate) - new Date()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Welcome back"
        subtitle="Manage your Instagram comment-to-DM automations."
        action={
          <button
            onClick={handleCreateAutomation}
            className="rounded-lg bg-[#7655db] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(118,85,219,0.18)] transition hover:-translate-y-0.5 hover:bg-[#6746cc]"
          >
            + Create Automation
          </button>
        }
      />

      {user?.subscriptionStatus === "trial" && (
        <TrialBanner
          daysRemaining={daysRemaining}
          onUpgrade={() => navigate("/billing")}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "30px",
        }}
      >
        <StatCard
          title="Active Automations"
          value={stats.activeAutomations}
          icon={<Bot size={22} />}
        />
        <StatCard
          title="DMs Sent"
          value={stats.dmsSent}
          icon={<MessageCircle size={22} />}
        />
        <StatCard
          title="Comments Processed"
          value={stats.commentsProcessed}
          icon={<KeyRound size={22} />}
        />
        <StatCard
          title="Instagram Accounts"
          value={stats.connectedAccounts}
          icon={<CircleUserRound size={22} />}
        />
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
