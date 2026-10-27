import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, MoreVertical, Plus, Zap, ExternalLink, MessageSquareText } from "lucide-react";
import API from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import AutomationCard from "../components/automation/AutomationCard";
import PageHeader from "../components/ui/PageHeader";

function Automations() {
  const navigate = useNavigate();
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
  const [automationSearch, setAutomationSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");

  const [editingId, setEditingId] = useState(null);

  const [media, setMedia] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [visibleMediaCount, setVisibleMediaCount] = useState(6);
  const [searchedMedia, setSearchedMedia] = useState([]);
  const [searchingMedia, setSearchingMedia] = useState(false);

  const handleCreateAutomation = async () => {
    try {
      const response = await API.get("/instagram/accounts");
      const accounts = response.data?.data || [];
      const hasActiveAccount = accounts.some((account) => account.status === "active");
      if (!hasActiveAccount) {
        navigate("/accounts", { state: { connectRequired: true } });
        return;
      }
      setEditingId(null);
      setShowForm(true);
    } catch (error) {
      console.error("Unable to verify Instagram connection:", error);
      alert("We could not verify your Instagram connection. Please try again.");
    }
  };

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

        const fetchedMedia = res.data.data || [];
        fetchedMedia.sort((a, b) => {
          const dateA = new Date(a.timestamp || a.created_time || 0).getTime();
          const dateB = new Date(b.timestamp || b.created_time || 0).getTime();
          return dateB - dateA;
        });
        setMedia(fetchedMedia);
        setVisibleMediaCount(6);

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

  useEffect(() => {
    const query = mediaSearch.trim();
    if (!query || triggerType !== "specific-post") {
      setSearchedMedia([]);
      setSearchingMedia(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setSearchingMedia(true);
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await API.get("/instagram/media", {
          params: { search: query },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setSearchedMedia(res.data.data || []);
      } catch (err) {
        if (!cancelled) {
          setSearchedMedia([]);
          console.error("Failed to search Instagram media:", err);
        }
      } finally {
        if (!cancelled) setSearchingMedia(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [mediaSearch, triggerType]);

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
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-600" /> WORKSPACE
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[34px]">Automations</h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">Create and manage your Instagram comment-to-DM workflows.</p>
        </div>
        <button onClick={handleCreateAutomation} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100">
          <Plus size={17} /> New automation
        </button>
      </div>

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

                  <input
                    type="search"
                    value={mediaSearch}
                    onChange={(e) => {
                      setMediaSearch(e.target.value);
                      setVisibleMediaCount(6);
                    }}
                    placeholder="Search your Reels by link"
                    aria-label="Search Instagram posts by caption or link"
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "12px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      marginBottom: "8px",
                    }}
                  />
                  <p style={{ margin: "0 0 14px", color: "#6B7280", fontSize: "12px" }}>
                    Showing the latest posts first. Search by caption or paste a post/Reel link to find older content.
                  </p>
                  {loadingMedia || (mediaSearch.trim() && searchingMedia) ? (
                    <p>{loadingMedia ? "Loading posts..." : "Searching your Instagram posts..."}</p>
                  ) : (
                    (() => {
                      const query = mediaSearch.trim();
                      const filteredMedia = query ? searchedMedia : media;
                      const visibleMedia = filteredMedia.slice(0, query ? filteredMedia.length : visibleMediaCount);
                      return (
                        <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      {visibleMedia.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => {
                            setSelectedPostId(post.id);
                            setSelectedPostUrl(post.permalink || "");
                          }}
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
                    {filteredMedia.length === 0 && (
                      <p style={{ color: "#6B7280", fontSize: "14px", marginBottom: "20px" }}>
                        No matching posts found. Try a different caption or paste the full Instagram post/Reel URL.
                      </p>
                    )}
                    {!query && visibleMediaCount < filteredMedia.length && (
                      <button
                        type="button"
                        onClick={() => setVisibleMediaCount((count) => count + 6)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "1px solid #E5E7EB",
                          borderRadius: "10px",
                          background: "#fff",
                          color: "#374151",
                          fontWeight: 600,
                          cursor: "pointer",
                          marginBottom: "20px",
                        }}
                      >
                        Load 6 more posts ({filteredMedia.length - visibleMediaCount} remaining)
                      </button>
                    )}
                        </>
                      );
                    })()
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Your workflows</h2>
            <p className="mt-1 text-sm text-slate-500">{automations.length} saved {automations.length === 1 ? "automation" : "automations"}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_165px] xl:w-[660px]">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={automationSearch} onChange={(event) => setAutomationSearch(event.target.value)} placeholder="Search automations..." className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-50" />
            </label>
            <label className="relative">
              <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50">
                <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <select value={triggerFilter} onChange={(event) => setTriggerFilter(event.target.value)} aria-label="Filter by trigger" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50">
                <option value="all">All triggers</option><option value="keyword">Keyword</option><option value="any_comment">Any comment</option>
              </select>
            </label>
          </div>
        </div>
        {automations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Zap size={22} /></span>
            <h3 className="font-semibold text-slate-900">No automations yet</h3>
            <p className="mt-1 text-sm text-slate-500">Create your first workflow to start responding to Instagram comments.</p>
            <button onClick={handleCreateAutomation} className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Create automation</button>
          </div>
        ) : (() => {
          const filtered = automations.filter((automation) => {
            const query = automationSearch.trim().toLowerCase();
            const keywords = Array.isArray(automation.keywords) ? automation.keywords.join(" ") : "";
            const title = keywords || "Any comment";
            const matchesSearch = !query || title.toLowerCase().includes(query) || (automation.dmMessage || "").toLowerCase().includes(query);
            const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? automation.status === "active" : automation.status !== "active");
            const type = automation.commentTriggerType || (automation.keywords?.length ? "keyword" : "any_comment");
            const matchesTrigger = triggerFilter === "all" || type === triggerFilter;
            return matchesSearch && matchesStatus && matchesTrigger;
          });
          return filtered.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">No automations match these filters. Try changing your search.</div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(140px,1fr)_100px_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500 lg:grid">
                <span>Automation</span><span>Trigger</span><span>Instagram post</span><span>Status</span><span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-slate-100">
                {filtered.map((automation) => {
                  const keywords = Array.isArray(automation.keywords) ? automation.keywords : [];
                  const active = automation.status === "active";
                  const trigger = automation.commentTriggerType || (keywords.length ? "keyword" : "any_comment");
                  const title = keywords[0] || "Any comment";
                  return (
                    <div key={automation._id} className="grid grid-cols-1 gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:px-6 lg:grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.8fr)_minmax(140px,1fr)_100px_100px] lg:items-center lg:gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><MessageSquareText size={18} strokeWidth={1.8} /></span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{automation.dmMessage || "No DM message configured"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:block">
                        <span className="text-xs text-slate-400 lg:hidden">Trigger</span>
                        <span className="inline-flex w-fit items-center rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">{trigger === "keyword" ? "Keyword" : "Any comment"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                        <span className="text-xs text-slate-400 lg:hidden">Post</span>
                        {automation.instagramMediaUrl ? <a href={automation.instagramMediaUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate hover:text-violet-700"><span className="truncate">{automation.instagramMediaUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split("/")[0] || "Instagram post"}</span><ExternalLink size={13} className="shrink-0" /></a> : <span className="text-slate-400">Selected Instagram post</span>}
                      </div>
                      <div className="flex items-center gap-2 lg:block">
                        <span className="text-xs text-slate-400 lg:hidden">Status</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex gap-2 lg:justify-end">
                        <button type="button" onClick={() => handleEditAutomation(automation)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Edit</button>
                        <button type="button" onClick={() => { if (window.confirm("Delete this automation? This cannot be undone.")) handleDeleteAutomation(automation._id); }} aria-label={`Delete ${title} automation`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><MoreVertical size={17} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </section>
    </DashboardLayout>
  );
}

export default Automations;