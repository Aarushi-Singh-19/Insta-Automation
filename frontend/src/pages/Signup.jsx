import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import API from "../services/api";

function Signup() {
  const referralCode = new URLSearchParams(window.location.search).get("ref");
  if (referralCode) localStorage.setItem("triggerdm_referral_code", referralCode.trim().toUpperCase());
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref") || localStorage.getItem("triggerdm_referral_code") || "";
      await API.post("/auth/signup", { name, email, password, referralCode: referralCode.trim().toUpperCase() });
      localStorage.removeItem("triggerdm_referral_code");
      alert("Account created successfully!");
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Signup failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen flex items-center justify-center px-5 py-10">
      <div className="auth-card w-full max-w-lg rounded-[28px] border p-8 sm:p-10">
        <Link to="/" className="auth-brand block text-center text-4xl font-extrabold tracking-tight">Trigger<span>DM</span></Link>
        <div className="mb-8 mt-4 text-center">
          <p className="text-2xl font-semibold text-slate-950">Create your account ✨</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Start automating your Instagram conversations.</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Full name</label>
            <input type="text" required autoComplete="name" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} className="auth-input w-full rounded-xl border px-4 py-3.5 outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input type="email" required autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input w-full rounded-xl border px-4 py-3.5 outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input type="password" required autoComplete="new-password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input w-full rounded-xl border px-4 py-3.5 outline-none" />
          </div>
          <button type="submit" disabled={loading} className="auth-submit flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white disabled:opacity-60">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-bold text-violet-700 hover:text-pink-600">Login</Link></p>
        <p className="mt-5 text-center text-xs text-slate-400"><Link to="/" className="hover:text-violet-700">← Back to TriggerDM</Link></p>
      </div>
    </main>
  );
}
export default Signup;
