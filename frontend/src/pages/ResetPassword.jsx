import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../services/api";

function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await API.post("/auth/forgot-password", { email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to request a reset link.");
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await API.post("/auth/reset-password", { token, password });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-gray-200 p-8">
        <h1 className="text-center text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">TriggerDM</h1>
        <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">{token ? "Choose a new password" : "Forgot your password?"}</h2>
        <p className="mt-2 mb-6 text-center text-gray-500">{token ? "Your reset link is valid for 30 minutes." : "Enter your account email and we’ll send a secure reset link."}</p>

        <form onSubmit={token ? updatePassword : requestReset} className="space-y-5">
          {!token ? (
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your account email" className={inputClass} />
            </div>
          ) : (
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">New password</label>
              <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={inputClass} />
            </div>
          )}
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold disabled:opacity-60">
            {loading ? "Please wait..." : token ? "Update password" : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-500"><Link to="/login" className="font-semibold text-purple-600 hover:text-purple-700">Back to login</Link></p>
      </div>
    </div>
  );
}

export default ResetPassword;