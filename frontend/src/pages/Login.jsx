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
      const res = await API.post("/auth/login", {
        email,
        password,
      });

      if (rememberMe) {
        localStorage.setItem("token", res.data.token);
        sessionStorage.removeItem("token");
      } else {
        sessionStorage.setItem("token", res.data.token);
        localStorage.removeItem("token");
      }

      navigate("/dashboard");
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Login failed. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-gray-200 p-8">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            TriggerDM
          </h1>

          <p className="mt-3 text-2xl font-semibold text-gray-900">
            Welcome Back 👋
          </p>

          <p className="mt-2 text-gray-500">
            Login to manage your Instagram automations.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <div className="flex items-center justify-between gap-3 -mt-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-purple-600"
              />
              Stay logged in
            </label>
            <Link to="/reset-password" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg
                  className="mr-3 h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>

                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-purple-600 hover:text-purple-700"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;