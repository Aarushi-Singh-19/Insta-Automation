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
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Automation Rules</h2>

        <button onClick={handleLogout}>Logout</button>
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
          {editingRuleId === rule._id ? (
            <>
              <input
                name="ruleName"
                value={editFormData.ruleName || ""}
                onChange={handleChange}
              />

              <input
                name="priority"
                value={editFormData.priority || ""}
                onChange={handleChange}
              />

              <input
                name="replyMode"
                value={editFormData.replyMode || ""}
                onChange={handleChange}
              />

              <input
                name="triggerKeywords"
                value={editFormData.triggerKeywords || ""}
                onChange={handleChange}
              />

              <button onClick={() => handleSaveEdit(rule._id)}>
                Save
              </button>

              <button onClick={handleCancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <h3>{rule.ruleName}</h3>

              <p>Priority: {rule.priority}</p>
              <p>Reply Mode: {rule.replyMode}</p>

              <p>
                Keywords: {(rule.triggerKeywords || []).join(", ")}
              </p>

              <p>
                Status: {rule.isActive ? "🟢 Active" : "🔴 Inactive"}
              </p>

              <button onClick={() => handleToggle(rule._id)}>
                {rule.isActive ? "Disable" : "Enable"}
              </button>

              <button onClick={() => handleEditClick(rule)}>
                Edit
              </button>

              <button onClick={() => handleDelete(rule._id)}>
                Delete
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default Dashboard;