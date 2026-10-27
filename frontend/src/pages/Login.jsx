import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import API from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      if (rememberMe) {
        localStorage.setItem("token", res.data.token);
        sessionStorage.removeItem("token");
      } else {
        sessionStorage.setItem("token", res.data.token);
        localStorage.removeItem("token");
      }
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen flex items-center justify-center px-5 py-10">
      <div className="auth-card w-full max-w-md rounded-[28px] border p-8 sm:p-10">
        <Link to="/" className="auth-brand block text-center text-4xl font-extrabold tracking-tight">
          Trigger<span>DM</span>
        </Link>
        <div className="mb-8 mt-4 text-center">
          <p className="text-2xl font-semibold text-slate-950">Welcome back 👋</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your Instagram conversations, on autopilot.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
            <input type="email" required autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input w-full rounded-xl border px-4 py-3.5 outline-none" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input type="password" required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input w-full rounded-xl border px-4 py-3.5 outline-none" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-violet-600" />
              Stay logged in
            </label>
            <Link to="/reset-password" className="text-sm font-semibold text-violet-700 hover:text-pink-600">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="auth-submit flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white disabled:opacity-60">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500">Don't have an account? <Link to="/signup" className="font-bold text-violet-700 hover:text-pink-600">Sign Up</Link></p>
        <p className="mt-5 text-center text-xs text-slate-400"><Link to="/" className="hover:text-violet-700">← Back to TriggerDM</Link></p>
      </div>
    </main>
  );
}
export default Login;
