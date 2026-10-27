import { useEffect, useState } from "react";
import { Copy, Users, Wallet, TrendingUp, Link2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import PageHeader from "../components/ui/PageHeader";
import API from "../services/api";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);

const landingReferralLink = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    const code = url.searchParams.get("ref");
    return code ? `${window.location.origin}/?ref=${encodeURIComponent(code)}` : value;
  } catch {
    return value;
  }
};

function Referrals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    API.get("/referrals/summary").then((response) => setData(response.data)).catch(() => setError("Unable to load your referral program right now."));
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(landingReferralLink(data.referralLink));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed. Please copy the referral link manually.");
    }
  };

  const card = "rounded-2xl border border-[#e8e3ed] bg-white p-5 shadow-[0_3px_16px_rgba(31,20,65,0.035)]";
  const stats = [
    { label: "Total referrals", value: data ? data.totalReferrals : "—", Icon: Users },
    { label: "Paid referrals", value: data ? data.payingReferrals : "—", Icon: TrendingUp },
    { label: "Eligible balance", value: money(data && data.eligibleBalance), Icon: Wallet },
    { label: "Paid out", value: money(data && data.totalEarned), Icon: CheckCircle2 },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Refer & Earn" subtitle="Share TriggerDM and earn 20% when your referrals pay for a subscription." />
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, Icon }) => (
          <div className={card} key={label}>
            <div className="flex items-center justify-between"><p className="text-sm text-[#777280]">{label}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0eaff] text-[#7655db]"><Icon size={19} /></span></div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-[#191724]">{value}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className={card}>
          <h2 className="text-lg font-bold text-[#191724]">Your referral link</h2>
          <p className="mt-1 text-sm text-[#777280]">Share this link with creators, businesses, and friends.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e8e3ed] bg-[#faf9fc] px-3 py-3"><Link2 size={18} className="shrink-0 text-[#7655db]" /><span className="min-w-0 break-all text-sm text-[#393545]">{data ? landingReferralLink(data.referralLink) : "Generating your unique link…"}</span></div>
            <button type="button" disabled={!data} onClick={copyLink} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7655db] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6544cc] disabled:opacity-50"><Copy size={16} />{copied ? "Copied!" : "Copy link"}</button>
          </div>
          <div className="mt-5 rounded-xl bg-[#f7f4ff] p-4 text-sm text-[#51466f]">You earn <strong>20%</strong> for each successful ₹199 subscription payment from a referred customer.</div>
        </div>
        <div className={card}>
          <h2 className="text-lg font-bold text-[#191724]">How it works</h2>
          <ol className="mt-4 space-y-4 text-sm text-[#625d6d]">
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] font-bold text-[#7655db]">1</span><span><strong className="text-[#191724]">Share your link</strong><br />Your referral code is unique to your account.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] font-bold text-[#7655db]">2</span><span><strong className="text-[#191724]">They subscribe</strong><br />A commission is recorded only after a successful payment is confirmed by Razorpay.</span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] font-bold text-[#7655db]">3</span><span><strong className="text-[#191724]">Build your balance</strong><br />The minimum payout threshold is ₹199. Bank payouts will be enabled after payout onboarding and verification.</span></li>
          </ol>
          <div className="mt-5 rounded-xl border border-[#eee8fa] p-3 text-xs leading-5 text-[#777280]">Referral earnings are tracked here. Bank transfers are not automatic yet.</div>
        </div>
      </section>
      <section className={card + " mt-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#191724]">People you referred</h2><p className="mt-1 text-sm text-[#777280]">Only names and account status are shown.</p></div><span className="rounded-full bg-[#f4f0ff] px-3 py-1.5 text-xs font-semibold text-[#7655db]">{data ? data.totalReferrals : 0} referrals</span></div>
        {!data || !data.referrals.length ? <p className="mt-6 rounded-xl border border-dashed border-[#ddd5eb] p-8 text-center text-sm text-[#777280]">No referrals yet. Share your link to get started.</p> : <div className="mt-5 divide-y divide-[#f0edf3]">{data.referrals.map((referral) => <div key={referral.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-[#191724]">{referral.name}</p><p className="mt-1 text-xs text-[#777280]">Joined {new Date(referral.joinedAt).toLocaleDateString("en-IN")}</p></div><span className={"rounded-full px-3 py-1.5 text-xs font-semibold " + (referral.subscriptionStatus === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[#f5f3f7] text-[#777280]")}>{referral.subscriptionStatus === "active" ? "Paid subscriber" : referral.subscriptionStatus === "trial" ? "Free trial" : referral.subscriptionStatus}</span></div>)}</div>}
      </section>
      <section className={card + " mt-6"}>
        <h2 className="text-lg font-bold text-[#191724]">Commission history</h2>
        {!data || !data.earnings.length ? <p className="mt-4 text-sm text-[#777280]">Commissions appear after a referred customer completes a successful subscription payment.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-[#eee8f2] text-xs uppercase tracking-wide text-[#898392]"><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Subscription payment</th><th className="py-3 pr-4">Commission</th><th className="py-3">Status</th></tr></thead><tbody>{data.earnings.map((earning) => <tr key={earning.id} className="border-b border-[#f3f0f5]"><td className="py-4 pr-4">{new Date(earning.createdAt).toLocaleDateString("en-IN")}</td><td className="py-4 pr-4">{money(earning.grossAmount)}</td><td className="py-4 pr-4 font-semibold">{money(earning.commissionAmount)}</td><td className="py-4 capitalize">{earning.status}</td></tr>)}</tbody></table></div>}
      </section>
    </DashboardLayout>
  );
}
export default Referrals;
