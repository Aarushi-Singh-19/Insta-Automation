import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

import CreateRuleForm from "../components/CreateRuleForm";

function Dashboard() {
  const [rules, setRules] = useState([]);
  const navigate = useNavigate();

useEffect(() => {
  fetchRules();

}, []);

  const fetchRules = async () => {
    try {
      const response = await API.get("/rules");

      setRules(response.data.data);
    } catch (error) {
      console.log("Error fetching rules:", error);
    }
  };
  const handleLogout = () => {
  localStorage.removeItem("token");

  navigate("/login");
};

  return (
  <div style={{ padding: "20px" }}>
    <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <h2>Automation Rules</h2>

  <button onClick={handleLogout}>
    Logout
  </button>
</div>

    <CreateRuleForm fetchRules={fetchRules} />

    {rules.map((rule) => (
      <div
        key={rule._id}
        style={{
          border: "1px solid gray",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        <h3>{rule.ruleName}</h3>

        <p>Priority: {rule.priority}</p>

        <p>Reply Mode: {rule.replyMode}</p>

        <p>
          Keywords: {rule.triggerKeywords.join(", ")}
        </p>
      </div>
    ))}
  </div>
);
}

export default Dashboard;