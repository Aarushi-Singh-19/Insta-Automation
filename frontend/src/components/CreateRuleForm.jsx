import { useState, useEffect } from "react";
import API from "../services/api";

function CreateRuleForm({ fetchRules, editingRule })  {
  const [ruleName, setRuleName] = useState("");
  const [priority, setPriority] = useState(1);
  const [keywords, setKeywords] = useState("");
  const [replyMode, setReplyMode] = useState("single");
  const [replies, setReplies] = useState("");

  useEffect(() => {
  if (editingRule) {
    setRuleName(editingRule.ruleName);
    setPriority(editingRule.priority);
    setKeywords(editingRule.triggerKeywords.join(", "));
    setReplyMode(editingRule.replyMode);
    setReplies(editingRule.replies.join(", "));
  }
}, [editingRule]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("Form submitted");

const newRule = {
  ruleName,
  priority: Number(priority),
  triggerType: "keywords",
  triggerKeywords: keywords.split(",").map(k => k.trim()),
  replyMode,
  replies: replies.split(",").map(r => r.trim()),
  isActive: true,
};

    try {
if (editingRule) {
  await API.put(`/rules/${editingRule._id}`, newRule);

  alert("Rule updated successfully");
} else {
  await API.post("/rules", newRule);

  alert("Rule created successfully");
}

      setRuleName("");
      setPriority(1);
      setKeywords("");
      setReplyMode("single");
      setReplies("");

      fetchRules();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid gray",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <h2>
  {editingRule ? "Edit Rule" : "Create Rule"}
</h2>

      <input
        type="text"
        placeholder="Rule Name"
        value={ruleName}
        onChange={(e) => setRuleName(e.target.value)}
      />

      <br />
      <br />

      <input
        type="number"
        placeholder="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      />

      <br />
      <br />

      <input
        type="text"
        placeholder="Keywords separated by commas"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />

      <br />
      <br />

      <select
        value={replyMode}
        onChange={(e) => setReplyMode(e.target.value)}
      >
        <option value="single">Single</option>
        <option value="random">Random</option>
      </select>

      <br />
      <br />

      <input
        type="text"
        placeholder="Replies separated by commas"
        value={replies}
        onChange={(e) => setReplies(e.target.value)}
      />

      <br />
      <br />

      <button type="submit">
  {editingRule ? "Update Rule" : "Create Rule"}
</button>
    </form>
  );
}

export default CreateRuleForm;