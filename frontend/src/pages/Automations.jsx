import { useState, useEffect } from "react";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";


function Automations() {

    const [showForm, setShowForm] = useState(false);
      const [triggerType, setTriggerType] = useState("any-post");

const [keywords, setKeywords] = useState("");

const [matchType, setMatchType] = useState("any");

const [dmMessage, setDmMessage] = useState("");

const [commentReplyEnabled, setCommentReplyEnabled] = useState(false);

const [commentReplyMessage, setCommentReplyMessage] = useState("");

const [followGate, setFollowGate] = useState(false);

const [automations, setAutomations] = useState([]);

const [editingId, setEditingId] = useState(null);


const handleSaveAutomation = async () => {
  try {
    const token = localStorage.getItem("token");

    const automationData = {
      triggerType,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      matchType,
      dmMessage,
      commentReplyEnabled,
      commentReplyMessage,
      followGate,
    };

    let res;

    if (editingId) {
      res = await API.put(
        `/automations/${editingId}`,
        automationData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } else {
      res = await API.post(
        "/automations",
        automationData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

   console.log("AUTOMATION SAVED:", res.data);

alert(
  editingId
    ? "Automation updated successfully"
    : "Automation saved successfully"
);

setEditingId(null);
setShowForm(false);

setTriggerType("any-post");
setKeywords("");
setMatchType("any");
setDmMessage("");
setCommentReplyEnabled(false);
setCommentReplyMessage("");
setFollowGate(false);

fetchAutomations();
  } catch (err) {
    console.error(err);
    alert("Failed to save automation");
  }

};

const fetchAutomations = async () => {
  try {
    const res = await API.get("/automations");
    setAutomations(res.data);
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteAutomation = async (id) => {
  try {
    await API.delete(`/automations/${id}`);

    setAutomations(
      automations.filter(
        (automation) => automation._id !== id
      )
    );
  } catch (err) {
    console.error(err);
    alert("Failed to delete automation");
  }
};

const handleEditAutomation = (automation) => {
  setEditingId(automation._id);

  setTriggerType(automation.triggerType);
  setKeywords(automation.keywords.join(", "));
  setMatchType(automation.matchType);
  setDmMessage(automation.dmMessage);
  setCommentReplyEnabled(
    automation.commentReplyEnabled
  );
  setCommentReplyMessage(
    automation.commentReplyMessage
  );
  setFollowGate(automation.followGate);

  setShowForm(true);
};

useEffect(() => {
  fetchAutomations();
}, []);

console.log({
  triggerType,
  keywords,
  matchType,
  dmMessage,
  commentReplyEnabled,
  commentReplyMessage,
  followGate,
});



  return (
    <DashboardLayout>
      <h1>Automations</h1>


<button
  onClick={() => setShowForm(true)}
  style={{
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    color: "white",
    background:
      "linear-gradient(135deg, #E1306C, #833AB4)",
  }}
>
  + Create Automation
</button>

{showForm && (
  
  <div
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      padding: "20px",
      marginTop: "20px",
    }}
  >
    <h3>Create Automation</h3>

<h3>1. Trigger</h3>

<select
  value={triggerType}
  onChange={(e) => setTriggerType(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    marginBottom: "20px",
  }}
>
  <option value="any-post">Any Post</option>
  <option value="specific-post">Specific Post</option>
  <option value="next-post">Next Post</option>
</select>

<h3>2. Keywords</h3>

<input
  value={keywords}
  onChange={(e) => setKeywords(e.target.value)}
  placeholder="Enter keyword"
  style={{
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
  }}
/>

<select
  value={matchType}
  onChange={(e) => setMatchType(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    marginBottom: "20px",
  }}
>
  <option value="any">Any Keyword</option>
  <option value="all">All Keywords</option>
</select>

<h3>3. DM Message</h3>

<textarea
  value={dmMessage}
  onChange={(e) => setDmMessage(e.target.value)}
  placeholder="Enter the DM message users will receive..."
  style={{
    width: "100%",
    minHeight: "150px",
    padding: "10px",
    marginBottom: "20px",
  }}
/>

<h3>4. Comment Reply</h3>

<label
  style={{
    display: "block",
    marginBottom: "10px",
  }}
>
  <input
  type="checkbox"
  checked={commentReplyEnabled}
  onChange={(e) =>
    setCommentReplyEnabled(e.target.checked)
  }
/>
  {" "}Reply to comment
</label>

<textarea
  value={commentReplyMessage}
  onChange={(e) =>
    setCommentReplyMessage(e.target.value)
  }
  disabled={!commentReplyEnabled}
  placeholder="Example: Check your DMs 👋"
  style={{
    width: "100%",
    minHeight: "80px",
    padding: "10px",
    marginBottom: "20px",
  }}
/>

<h3>5. Advanced</h3>

<label
  style={{
    display: "block",
    marginBottom: "20px",
  }}
>

<input
  type="checkbox"
  checked={followGate}
  onChange={(e) => setFollowGate(e.target.checked)}
/>
  {" "}Ask user to follow before DM
</label>

<button
  onClick={handleSaveAutomation}
  style={{
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    color: "white",
    cursor: "pointer",
    background:
      "linear-gradient(135deg, #E1306C, #833AB4)",
  }}
>
  Save Automation
</button>

  </div>
)}

<h2 style={{ marginTop: "30px" }}>
  Saved Automations
</h2>

{automations.length === 0 ? (
  <p>No automations yet.</p>
) : (
  automations.map((automation) => (
    <div
      key={automation._id}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        marginTop: "12px",
      }}
    >
      <p>
        <strong>Keywords:</strong>{" "}
        {automation.keywords.join(", ")}
      </p>

      <p>
        <strong>Match Type:</strong>{" "}
        {automation.matchType}
      </p>

      <p>
        <strong>Status:</strong>{" "}
        {automation.status}
      </p>

      <button
  onClick={() =>
    handleDeleteAutomation(automation._id)
  }
  style={{
    marginTop: "10px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
  Delete
</button>

<button
  onClick={() => handleEditAutomation(automation)}
>
  Edit
</button>

    </div>
  ))
)}
    </DashboardLayout>
  );
}

export default Automations;