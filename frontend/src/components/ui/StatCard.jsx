function StatCard({ title, value, icon, color = "#7C3AED" }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: "#F3E8FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </div>

      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "30px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {value}
        </h2>

        <p
          style={{
            marginTop: "6px",
            color: "#6B7280",
            fontSize: "15px",
          }}
        >
          {title}
        </p>
      </div>
    </div>
  );
}

export default StatCard;