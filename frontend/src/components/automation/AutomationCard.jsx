import {
  Bot,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Hash,
  MessageSquare,
} from "lucide-react";

function AutomationCard({
  automation,
  onEdit,
  onDelete,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        transition: "0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Bot color="#7C3AED" />

          <h3
            style={{
              margin: 0,
            }}
          >
            {automation.keywords.length > 0
              ? automation.keywords[0]
              : "Automation"}
          </h3>
        </div>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color:
              automation.status === "active"
                ? "#16A34A"
                : "#DC2626",
            fontWeight: "600",
          }}
        >
          {automation.status === "active" ? (
            <CheckCircle size={18} />
          ) : (
            <XCircle size={18} />
          )}

          {automation.status}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        <div>
          <strong>Keywords</strong>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6B7280",
            }}
          >
            {automation.keywords.join(", ")}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "30px",
          }}
        >
          <div>
            <strong>Match</strong>

            <p
              style={{
                margin: "6px 0 0",
                color: "#6B7280",
              }}
            >
              <Hash size={14} /> {automation.matchType}
            </p>
          </div>

          <div>
            <strong>Trigger</strong>

            <p
              style={{
                margin: "6px 0 0",
                color: "#6B7280",
              }}
            >
              {automation.triggerType}
            </p>
          </div>
        </div>

        <div>
          <strong>DM Message</strong>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6B7280",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            <MessageSquare size={14} />{" "}
            {automation.dmMessage || "No message"}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => onEdit(automation)}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#F3E8FF",
            color: "#7C3AED",
            fontWeight: "600",
          }}
        >
          <Pencil size={16} /> Edit
        </button>

        <button
          onClick={() => onDelete(automation._id)}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#FEE2E2",
            color: "#DC2626",
            fontWeight: "600",
          }}
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </div>
  );
}

export default AutomationCard;