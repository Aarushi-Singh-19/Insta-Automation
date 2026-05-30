import { useNavigate } from "react-router-dom";
import { useState } from "react";
import API from "../services/api";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

const handleLogin = async (e) => {
  e.preventDefault();

  console.log("LOGIN CLICKED"); // 🔥 IMPORTANT

  try {
    const res = await API.post("/auth/login", {
  email,
  password
});

    console.log("SUCCESS:", res.data);
    localStorage.setItem("token", res.data.token);

    navigate("/dashboard");
  } catch (err) {
    console.log("ERROR:", err);
  }
};

  return (
    <div style={{ padding: "20px" }}>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <br /><br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <br /><br />

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;