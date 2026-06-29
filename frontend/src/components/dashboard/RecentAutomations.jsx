function RecentAutomations({ rules }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ margin: 0 }}>Recent Automations</h3>

        <span
          style={{
            color: "#7C3AED",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          View All
        </span>
      </div>

      {rules.length === 0 ? (
        <p style={{ color: "#6B7280" }}>
          No automations created yet.
        </p>
      ) : (
        rules.slice(0, 5).map((rule) => (
          <div
            key={rule._id}
            style={{
              padding: "16px 0",
              borderTop: "1px solid #F3F4F6",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>{rule.ruleName}</strong>

              <span
                style={{
                  color: rule.isActive
                    ? "#16A34A"
                    : "#DC2626",
                }}
              >
                {rule.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div
              style={{
                marginTop: "8px",
                color: "#6B7280",
                fontSize: "14px",
              }}
            >
              Priority {rule.priority}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default RecentAutomations;