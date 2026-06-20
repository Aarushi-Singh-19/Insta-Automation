import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

import CreateRuleForm from "../components/CreateRuleForm";

function Dashboard() {
  const [rules, setRules] = useState([]);

  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

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

  const handleEditClick = (rule) => {
    setEditingRuleId(rule._id);

    setEditFormData({
      ruleName: rule.ruleName,
      priority: rule.priority,
      replyMode: rule.replyMode,
      triggerKeywords: rule.triggerKeywords || [],
      isActive: rule.isActive,
    });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditFormData({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setEditFormData((prev) => ({
      ...prev,
      [name]: name === "priority" ? Number(value) : value,
    }));
  };

  const handleSaveEdit = async (id) => {
    try {
      const res = await API.put(`/rules/${id}`, editFormData);

      setRules((prev) =>
        prev.map((rule) => (rule._id === id ? res.data : rule))
      );

      setEditingRuleId(null);
      setEditFormData({});
    } catch (error) {
      console.log("Update failed:", error);
    }
  };

  const handleToggle = async (id) => {
    try {
      const response = await API.patch(`/rules/toggle/${id}`);
      const updatedRule = response.data;

      setRules((prev) =>
        prev.map((rule) => (rule._id === id ? updatedRule : rule))
      );
    } catch (error) {
      console.log("Error toggling rule:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/rules/${id}`);

      setRules((prev) => prev.filter((rule) => rule._id !== id));
    } catch (error) {
      console.log("Error deleting rule:", error);
    }
  };

  return (
  <div style={{ display: "flex", minHeight: "100vh" }}>
    
<div
  style={{
    width: "250px",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    padding: "20px",
    minHeight: "100vh",
  }}
>
<h2
  style={{
    background: "linear-gradient(135deg, #E1306C, #833AB4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontWeight: "bold",
  }}
>
  TriggerDM
</h2>

<p style={{ color: "#374151" }}>Overview</p>
<p style={{ color: "#374151" }}>Automations</p>
<p style={{ color: "#374151" }}>Instagram Accounts</p>
<p style={{ color: "#374151" }}>Billing</p>
<p style={{ color: "#374151" }}>Settings</p>

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>

    <div style={{ padding: "30px" }}>
      <h1>Overview Page</h1>
      <p>Welcome to TriggerDM</p>
    </div>

  </div>
);
}

export default Dashboard;