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
  const [rules, setRules] = useState([]);
  const [user, setUser] = useState(null);

  const [analytics, setAnalytics] = useState({
    queued: 0,
    success: 0,
    failed: 0,
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchRules();
    fetchUser();
    fetchAnalytics();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await API.get("/rules");
      setRules(response.data.data);
    } catch (error) {
      console.log("Error fetching rules:", error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/trends");
      setAnalytics(res.data);
    } catch (error) {
      console.log("Analytics error:", error);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await API.get("/auth/me");
      setUser(res.data.user);
    } catch (error) {
      console.log("Error fetching user:", error);
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
        title="Welcome back 👋"
        subtitle="Manage your Instagram comment-to-DM automations."
        action={
          <button
            style={{
              padding: "12px 20px",
              border: "none",
              borderRadius: "10px",
              background: "linear-gradient(135deg,#E1306C,#833AB4)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "600",
            }}
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
          value={rules.length}
          icon={<Bot size={22} />}
        />

        <StatCard
          title="DMs Sent"
          value={analytics.success}
          icon={<MessageCircle size={22} />}
        />

        <StatCard
          title="Keywords Triggered"
          value={rules.length}
          icon={<KeyRound size={22} />}
        />

        <StatCard
          title="Instagram Accounts"
          value="1"
          icon={<CircleUserRound size={22} />}
        />
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;