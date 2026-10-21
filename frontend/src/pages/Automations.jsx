import { useState, useEffect } from "react";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import AutomationCard from "../components/automation/AutomationCard";
import PageHeader from "../components/ui/PageHeader";

function Automations() {
  const [showForm, setShowForm] = useState(false);
  const [triggerType, setTriggerType] = useState("specific-post");

  const [keywords, setKeywords] = useState("");

  const [commentTriggerType, setCommentTriggerType] =
    useState("keyword");

  const [dmMessage, setDmMessage] = useState("");
  const [dmButtons, setDmButtons] = useState([]);

  const [commentReplyEnabled, setCommentReplyEnabled] =
    useState(false);

  const [commentReplyMessage, setCommentReplyMessage] =
    useState("");

  const [followGate, setFollowGate] = useState(false);
  const [followGateMessage, setFollowGateMessage] = useState("Please follow our profile to unlock your DM! 💖");
  const [selectedPostUrl, setSelectedPostUrl] = useState("");

  const [automations, setAutomations] = useState([]);

  const [editingId, setEditingId] = useState(null);

  const [media, setMedia] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [loadingMedia, setLoadingMedia] = useState(false);

  const handleSaveAutomation = async () => {
    try {
      if (
        commentTriggerType === "keyword" &&
        !keywords.trim()
      ) {
        alert("Please enter a keyword.");
        return;
      }

      if (triggerType === "specific-post" && !selectedPostId) {
        alert("Please select an Instagram post.");
        return;
      }

      const configuredButtons = dmButtons.filter((button) => button.title.trim() || button.url.trim());
      if (configuredButtons.some((button) => !button.title.trim() || button.title.trim().length > 20 || !button.url.trim().toLowerCase().startsWith("https://"))) {
        alert("Each DM button needs a label (max 20 characters) and a valid HTTPS URL.");
        return;
      }
      if (configuredButtons.length > 0 && dmMessage.trim().length > 640) {
        alert("Instagram button DMs support up to 640 characters. Shorten the DM message before adding buttons.");
        return;
      }

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      const automationData = {
        triggerType,
        instagramMediaId: selectedPostId,
        instagramMediaUrl: selectedPostUrl || media.find((post) => post.id === selectedPostId)?.permalink || "",

        commentTriggerType,

        keywords:
          commentTriggerType === "keyword"
            ? keywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
            : [],

        dmMessage,
        dmButtons: dmButtons.filter((button) => button.title.trim() && button.url.trim()),
        commentReplyEnabled,
        commentReplyMessage,
        followGate,
        followGateMessage,
      };

      console.log("Automation Data:", automationData);
      console.log("Selected Post ID:", selectedPostId);

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

      setTriggerType("specific-post");
      setKeywords("");
      setCommentTriggerType("keyword");
      setDmMessage("");
      setDmButtons([]);
      setCommentReplyEnabled(false);
      setCommentReplyMessage("");
      setFollowGate(false);
      setFollowGateMessage("Please follow our profile to unlock your DM! 💖");
      setSelectedPostId("");
      setSelectedPostUrl("");

      fetchAutomations();
    } catch (err) {
      console.error(err);
      alert("Failed to save automation");
    }
  };

  const fetchAutomations = async () => {
    try {
      const res = await API.get("/automations");
      console.log("Automations:", res.data);
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

    setSelectedPostId(
      automation.instagramMediaId || ""
    );
    setSelectedPostUrl(automation.instagramMediaUrl || "");

    setCommentTriggerType(
      automation.commentTriggerType ||
        (automation.keywords?.length > 0
          ? "keyword"
          : "any_comment")
    );

    setKeywords(
      automation.keywords
        ? automation.keywords.join(", ")
        : ""
    );

    setDmMessage(automation.dmMessage);
    setDmButtons(Array.isArray(automation.dmButtons) ? automation.dmButtons : []);

    setCommentReplyEnabled(
      automation.commentReplyEnabled
    );

    setCommentReplyMessage(
      automation.commentReplyMessage
    );

    setFollowGate(automation.followGate);
    setFollowGateMessage(automation.followGateMessage || "Please follow our profile to unlock your DM! 💖");

    setShowForm(true);
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  useEffect(() => {
    console.log("Media useEffect triggered");

    const fetchInstagramMedia = async () => {
      if (triggerType !== "specific-post") return;

      try {
        setLoadingMedia(true);

        const token = localStorage.getItem("token") || sessionStorage.getItem("token");

        const res = await API.get("/instagram/media", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("Instagram Media:", res.data);

        setMedia(res.data.data || []);

        console.log(
          "Media Length:",
          res.data.data.length
        );
      } catch (err) {
        console.error(
          "Failed to load Instagram media:",
          err
        );
      } finally {
        setLoadingMedia(false);
      }
    };

    fetchInstagramMedia();
  }, [triggerType]);

  console.log({
    triggerType,
    commentTriggerType,
    keywords,
    dmMessage,
    commentReplyEnabled,
    commentReplyMessage,
    followGate,
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Automations"
        subtitle="Manage your Instagram comment-to-DM automations."
        action={
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              cursor: "pointer",
              background:
                "linear-gradient(135deg,#E1306C,#833AB4)",
              fontWeight: "600",
            }}
          >
            + Create Automation
          </button>
        }
      />

      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "32px",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "22px",
              boxShadow:
                "0 25px 70px rgba(0,0,0,0.22)",
            }}
          >
            {/* Header */}

            <div
              style={{
                padding: "24px 30px",
                borderBottom:
                  "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 10,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: "700",
                  }}
                >
                  {editingId
                    ? "Edit Automation"
                    : "Create Automation"}
                </h2>

                <p
                  style={{
                    marginTop: "6px",
                    color: "#6B7280",
                    fontSize: "14px",
                  }}
                >
                  Configure your Instagram comment automation.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                style={{
                  width: "42px",
                  height: "42px",
                  border: "none",
                  borderRadius: "12px",
                  background: "#F3F4F6",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}

            <div
              style={{
                padding: "32px",
              }}
            >
              <h3>Create Automation</h3>

              <h3>1. Trigger</h3>

              <select
                value={triggerType}
                onChange={(e) =>
                  setTriggerType(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "12px",
                  fontSize: "15px",
                  background: "#fff",
                  marginBottom: "20px",
                  boxSizing: "border-box",
                }}
              >
                <option value="specific-post">
                  Specific Post
                </option>
              </select>

              <h3>2. Comment Trigger</h3>

              <select
                value={commentTriggerType}
                onChange={(e) =>
                  setCommentTriggerType(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "12px",
                  fontSize: "15px",
                  background: "#fff",
                  marginBottom: "18px",
                  boxSizing: "border-box",
                }}
              >
                <option value="keyword">
                  Specific Keyword
                </option>

                <option value="any_comment">
                  All Comments
                </option>
              </select>

              {commentTriggerType === "keyword" && (
                <>
                  <input
                    value={keywords}
                    onChange={(e) =>
                      setKeywords(e.target.value)
                    }
                    placeholder="Enter keyword"
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border:
                        "1px solid #D1D5DB",
                      borderRadius: "12px",
                      fontSize: "15px",
                      outline: "none",
                      marginBottom: "8px",
                      boxSizing: "border-box",
                    }}
                  />

                  <p
                    style={{
                      marginTop: "0",
                      marginBottom: "20px",
                      color: "#6B7280",
                      fontSize: "13px",
                    }}
                  >
                    Only comments containing this
                    keyword will trigger the automation.
                  </p>
                </>
              )}

              {commentTriggerType === "any_comment" && (
                <div
                  style={{
                    padding: "14px 16px",
                    marginBottom: "20px",
                    background: "#F9FAFB",
                    border:
                      "1px solid #E5E7EB",
                    borderRadius: "12px",
                    color: "#4B5563",
                    fontSize: "14px",
                  }}
                >
                  Every comment on the selected post or
                  reel will trigger this automation.
                </div>
              )}

              {triggerType === "specific-post" && (
                <>
                  <h3>Select Instagram Post</h3>

                  {loadingMedia ? (
                    <p>Loading posts...</p>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(170px, 1fr))",
                        gap: "12px",
                        marginBottom: "20px",
                      }}
                    >
                      {media.map((post) => (
                        <div
                          key={post.id}
                          onClick={() =>
                            setSelectedPostId(post.id);
                            setSelectedPostUrl(post.permalink || "");
                          }
                          style={{
                            cursor: "pointer",
                            border:
                              selectedPostId === post.id
                                ? "3px solid #E1306C"
                                : "2px solid #E5E7EB",
                            borderRadius: "12px",
                            overflow: "hidden",
                            position: "relative",
                            transition: "0.2s",
                            transform:
                              selectedPostId === post.id
                                ? "scale(1.03)"
                                : "scale(1)",
                            boxShadow:
                              selectedPostId === post.id
                                ? "0 8px 20px rgba(225,48,108,.25)"
                                : "0 2px 8px rgba(0,0,0,.08)",
                          }}
                        >
                          <img
                            src={
                              post.thumbnail_url ||
                              post.media_url
                            }
                            alt="Instagram"
                            style={{
                              width: "100%",
                              height: "150px",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />

                          <div
                            style={{
                              position: "absolute",
                              top: "10px",
                              left: "10px",
                              background:
                                "rgba(0,0,0,.65)",
                              color: "#fff",
                              padding: "4px 8px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            {post.media_type === "VIDEO"
                              ? "🎥 Reel"
                              : post.media_type ===
                                "CAROUSEL_ALBUM"
                              ? "📚 Carousel"
                              : "🖼️ Post"}
                          </div>

                          {selectedPostId === post.id && (
                            <div
                              style={{
                                position: "absolute",
                                top: "10px",
                                right: "10px",
                                background: "#E1306C",
                                color: "#fff",
                                padding: "5px 10px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "700",
                              }}
                            >
                              ✓ Selected
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <h3>3. DM Message</h3>

              <textarea
                value={dmMessage}
                onChange={(e) =>
                  setDmMessage(e.target.value)
                }
                placeholder="Enter the DM message users will receive..."
                style={{
                  width: "100%",
                  minHeight: "140px",
                  padding: "14px 16px",
                  border:
                    "1px solid #D1D5DB",
                  borderRadius: "12px",
                  fontSize: "15px",
                  resize: "vertical",
                  marginBottom: "20px",
                  boxSizing: "border-box",
                }}
              />

              <section
                style={{
                  margin: "8px 0 28px",
                  padding: "22px",
                  border: "1px solid #E9DFFF",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #FCFAFF 0%, #FFFFFF 100%)",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#F0E9FF", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>↗</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px", lineHeight: 1.4 }}>DM Buttons <span style={{ marginLeft: "6px", padding: "3px 9px", borderRadius: "999px", background: "#F0E9FF", color: "#6D28D9", fontSize: "12px", fontWeight: 600 }}>Optional</span></h3>
                  </div>
                </div>
                <p style={{ color: "#6B7280", fontSize: "13px", lineHeight: 1.5, margin: "0 0 18px" }}>
                  Add up to 3 website links that appear with your DM. Button labels can be up to 20 characters.
                </p>

                {dmButtons.map((button, index) => (
                  <div key={index} style={{ border: "1px solid #E5E7EB", borderRadius: "12px", padding: "16px", background: "#FFFFFF", marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                      <strong style={{ fontSize: "15px" }}>Button {index + 1}</strong>
                      <button type="button" onClick={() => setDmButtons((items) => items.filter((_, i) => i !== index))} style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", fontSize: "14px", padding: "4px 0" }}>Remove</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "12px" }}>
                      <input value={button.title} maxLength={20} onChange={(e) => setDmButtons((items) => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Button label (e.g. Get the link)" aria-label={`Button ${index + 1} label`} style={{ width: "100%", minWidth: 0, padding: "13px 14px", border: "1px solid #D1D5DB", borderRadius: "10px", boxSizing: "border-box", fontSize: "14px" }} />
                      <input type="url" value={button.url} onChange={(e) => setDmButtons((items) => items.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} placeholder="https://example.com" aria-label={`Button ${index + 1} HTTPS URL`} style={{ width: "100%", minWidth: 0, padding: "13px 14px", border: "1px solid #D1D5DB", borderRadius: "10px", boxSizing: "border-box", fontSize: "14px" }} />
                    </div>
                    <div style={{ textAlign: "right", fontSize: "12px", color: "#9CA3AF", marginTop: "6px" }}>{button.title.length}/20 characters</div>
                  </div>
                ))}

                {dmButtons.length < 3 && (
                  <button type="button" onClick={() => setDmButtons((items) => [...items, { title: "", url: "" }])} style={{ width: "100%", padding: "13px 16px", border: "1px dashed #C4B5FD", borderRadius: "11px", background: "#FFFFFF", color: "#7C3AED", cursor: "pointer", fontSize: "15px", fontWeight: 600 }}>
                    + Add another button
                  </button>
                )}
              </section>

              <h3 style={{ margin: "0 0 14px", fontSize: "18px" }}>4. Comment Reply</h3>

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
                    setCommentReplyEnabled(
                      e.target.checked
                    )
                  }
                />{" "}
                Reply to comment
              </label>

              <textarea
                value={commentReplyMessage}
                onChange={(e) =>
                  setCommentReplyMessage(
                    e.target.value
                  )
                }
                disabled={!commentReplyEnabled}
                placeholder="Example: Check your DMs 👋"
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "14px 16px",
                  border:
                    "1px solid #D1D5DB",
                  borderRadius: "12px",
                  fontSize: "15px",
                  resize: "vertical",
                  marginBottom: "20px",
                  boxSizing: "border-box",
                }}
              />

              <h3>5. Advanced</h3>

              <label
                style={{
                  display: "block",
                  marginBottom: "30px",
                }}
              >
                <input
                  type="checkbox"
                  checked={followGate}
                  onChange={(e) =>
                    setFollowGate(e.target.checked)
                  }
                />{" "}
                Ask user to follow before DM
              </label>

              {followGate && (
                <div style={{ marginTop: "-16px", marginBottom: "24px" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
                    Follow-gate message
                  </label>
                  <textarea
                    value={followGateMessage}
                    onChange={(e) => setFollowGateMessage(e.target.value)}
                    maxLength={640}
                    placeholder="Please follow our profile to unlock your DM! 💖"
                    style={{ width: "100%", minHeight: "90px", padding: "14px 16px", border: "1px solid #D1D5DB", borderRadius: "12px", fontSize: "15px", resize: "vertical", boxSizing: "border-box" }}
                  />
                  <p style={{ margin: "6px 0 0", color: "#6B7280", fontSize: "12px" }}>
                    Example: Please follow our profile to unlock your DM! 💖 You can personalize this message for each automation.
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  paddingTop: "24px",
                  borderTop:
                    "1px solid #E5E7EB",
                }}
              >
                <button
                  onClick={() => {
                    setEditingId(null);
                    setShowForm(false);
                  }}
                  style={{
                    padding: "14px 22px",
                    borderRadius: "12px",
                    border:
                      "1px solid #D1D5DB",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveAutomation}
                  style={{
                    padding: "14px 26px",
                    border: "none",
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg,#E1306C,#833AB4)",
                    color: "#fff",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "15px",
                  }}
                >
                  {editingId
                    ? "Update Automation"
                    : "Save Automation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: "30px" }}>
        Saved Automations
      </h2>

      {automations.length === 0 ? (
        <p>No automations yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(380px, 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {automations.map((automation) => (
            <AutomationCard
              key={automation._id}
              automation={automation}
              onEdit={handleEditAutomation}
              onDelete={handleDeleteAutomation}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export default Automations;