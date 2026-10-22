import { useEffect, useState } from "react";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import { Users, Instagram, Clock3, CreditCard, AlertTriangle, RefreshCw } from "lucide-react";

const formatCurrency = (paise) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format((Number(paise) || 0) / 100);

function Metric({ title, value, icon: Icon, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="rounded-xl bg-purple-50 p-2 text-purple-700"><Icon size={20} /></span>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Admin() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/admin/overview");
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load admin data. Confirm your account is configured as ADMIN_EMAIL on the backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = data?.metrics;
  const cards = metrics ? [
    { title: "Registered users", value: metrics.totalUsers, icon: Users },
    { title: "Instagram connected", value: metrics.instagramConnected, icon: Instagram },
    { title: "Active free trials", value: metrics.activeTrials, icon: Clock3 },
    { title: "Active paid subscribers", value: metrics.activePaidSubscribers, icon: CreditCard, note: "Active status with an unexpired plan end date" },
    { title: "Expired trials", value: metrics.expiredTrials, icon: Clock3 },
    { title: "Past-due subscribers", value: metrics.pastDueSubscribers, icon: AlertTriangle },
    { title: "Cancelled subscriptions", value: metrics.cancelledSubscribers, icon: CreditCard },
    { title: "Halted subscriptions", value: metrics.haltedSubscribers, icon: AlertTriangle },
    { title: "Captured payments", value: metrics.capturedPayments, icon: CreditCard },
    { title: "Captured payment total", value: formatCurrency(metrics.capturedRevenuePaise), icon: CreditCard, note: "Sum of captured payment records; not a revenue-recognition report" },
  ] : [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Admin overview"
        subtitle="Private overview of TriggerDM users, trials, subscriptions, and recorded payments."
        action={<button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>}
      />

      {loading && <p className="mt-6 text-slate-600">Loading admin metrics…</p>}
      {!loading && error && (
        <div role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">Admin dashboard unavailable</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {!loading && metrics && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => <Metric key={card.title} {...card} />)}
          </div>

          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">Recent sign-ups</h2>
              <p className="mt-1 text-sm text-slate-500">Latest 10 registered accounts. Email is visible only to the authorized admin.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Instagram</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                    <th className="px-5 py-3 font-semibold">Trial ends</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentUsers.map((user) => (
                    <tr key={user._id}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{user.name || "—"}</div>
                        <div className="text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{user.subscriptionStatus || "unknown"}</span></td>
                      <td className="px-5 py-3">{user.instagramConnected ? "Connected" : "Not connected"}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{user.trialEndDate ? new Date(user.trialEndDate).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                  {data.recentUsers.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-500">No users registered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-4 text-xs text-slate-500">Updated {new Date(data.generatedAt).toLocaleString("en-IN")}. “Currently logged in” is not shown: the app uses seven-day JWTs and does not currently maintain a live session/presence tracker.</p>
        </>
      )}
    </DashboardLayout>
  );
}

export default Admin;
