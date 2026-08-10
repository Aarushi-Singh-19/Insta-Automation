import { useState, useEffect } from "react";
import API from "../services/api";

function CreateRuleForm({
  fetchRules,
  editingRule,
  clearEditingRule,
}) {
  const [ruleName, setRuleName] = useState("");
  const [priority, setPriority] = useState(1);

  // keyword or all_comments
  const [triggerType, setTriggerType] = useState("keyword");

  const [keywords, setKeywords] = useState("");
  const [replyMode, setReplyMode] = useState("single");
  const [replies, setReplies] = useState("");

  useEffect(() => {
    if (editingRule) {
      setRuleName(editingRule.ruleName || "");
      setPriority(editingRule.priority || 1);

      // Existing keyword rules remain keyword rules.
      // Existing all_comments rules are loaded correctly.
      setTriggerType(editingRule.triggerType || "keyword");

      setKeywords(
        editingRule.triggerKeywords
          ? editingRule.triggerKeywords.join(", ")
          : ""
      );

      setReplyMode(editingRule.replyMode || "single");

      setReplies(
        editingRule.replies
          ? editingRule.replies.join(", ")
          : ""
      );
    }
  }, [editingRule]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Keyword mode requires a keyword.
    if (triggerType === "keyword" && !keywords.trim()) {
      alert("Please enter a keyword.");
      return;
    }

    const newRule = {
      ruleName,
      priority: Number(priority),

      // IMPORTANT:
      // keyword = only matching comments trigger
      // all_comments = every comment triggers
      triggerType,

      // No keywords are needed for all_comments.
      triggerKeywords:
        triggerType === "keyword"
          ? keywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [],

      replyMode,

      replies: replies
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),

      isActive: true,
    };

    console.log("Rule payload:", newRule);

    try {
      if (editingRule) {
        await API.put(`/rules/${editingRule._id}`, newRule);

        alert("Rule updated successfully");
        clearEditingRule();
      } else {
        await API.post("/rules", newRule);

        alert("Rule created successfully");
      }

      // Reset form
      setRuleName("");
      setPriority(1);
      setTriggerType("keyword");
      setKeywords("");
      setReplyMode("single");
      setReplies("");

      fetchRules();
    } catch (error) {
      console.error(
        "Error saving rule:",
        error.response?.data || error
      );

      alert(
        error.response?.data?.message ||
          "Failed to save rule"
      );
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
      <h3>
        {editingRule ? "Edit Rule" : "Create Rule"}
      </h3>

      {/* Rule Name */}
      <input
        type="text"
        placeholder="Rule Name"
        value={ruleName}
        onChange={(e) => setRuleName(e.target.value)}
      />

      <br />
      <br />

      {/* Priority */}
      <input
        type="number"
        placeholder="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      />

      <br />
      <br />

      {/* Trigger Type */}
      <label>
        <strong>When should this automation trigger?</strong>
      </label>

      <br />
      <br />

      <select
        value={triggerType}
        onChange={(e) => setTriggerType(e.target.value)}
      >
        <option value="keyword">
          Specific Keyword
        </option>

  <option value="any_comment">
  All Comments
</option>
      </select>

      <br />
      <br />

      {/* Keyword field only for keyword mode */}
      {triggerType === "keyword" && (
        <>
          <input
            type="text"
            placeholder="Enter keyword"
            value={keywords}
            onChange={(e) =>
              setKeywords(e.target.value)
            }
          />

          <br />

          <small>
            Only comments containing this keyword
            will trigger the automation.
          </small>

          <br />
          <br />
        </>
      )}

      {/* All comments explanation */}
      {triggerType === "any_comment" && (
        <>
          <div
            style={{
              padding: "10px",
              background: "#f5f5f5",
              borderRadius: "6px",
            }}
          >
            Every comment on the selected post or reel
            will trigger this automation.
          </div>

          <br />
        </>
      )}

      {/* Reply Mode */}
      <select
        value={replyMode}
        onChange={(e) =>
          setReplyMode(e.target.value)
        }
      >
        <option value="single">Single</option>
        <option value="random">Random</option>
      </select>

      <br />
      <br />

      {/* Replies */}
      <input
        type="text"
        placeholder="Replies separated by commas"
        value={replies}
        onChange={(e) =>
          setReplies(e.target.value)
        }
      />

      <br />
      <br />

      <button type="submit">
        {editingRule
          ? "Update Rule"
          : "Create Rule"}
      </button>
    </form>
  );
}

export default CreateRuleForm;