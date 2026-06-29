import { PlusCircle } from "lucide-react";

function EmptyState({
  title,
  description,
  buttonText,
  onClick,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "48px",
        textAlign: "center",
      }}
    >
      <PlusCircle
        size={52}
        color="#7C3AED"
      />

      <h2
        style={{
          marginTop: "20px",
          marginBottom: "10px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          color: "#6B7280",
          marginBottom: "24px",
        }}
      >
        {description}
      </p>

      <button
        onClick={onClick}
        style={{
          padding: "12px 20px",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          background:
            "linear-gradient(135deg,#E1306C,#833AB4)",
          color: "white",
          fontWeight: "600",
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

export default EmptyState;