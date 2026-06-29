import { ArrowRight } from "lucide-react";

function TrialBanner({ daysRemaining, onUpgrade }) {
  return (
    <div
      style={{
        marginBottom: "32px",
        padding: "24px",
        borderRadius: "16px",
        background: "#FEF3C7",
        border: "1px solid #F59E0B",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            color: "#92400E",
          }}
        >
          🚀 Free Trial Active
        </h3>

        <p
          style={{
            marginTop: "8px",
            color: "#92400E",
          }}
        >
          {daysRemaining} day(s) remaining in your free trial.
        </p>
      </div>

      <button
        onClick={onUpgrade}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 18px",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          background: "#F59E0B",
          color: "white",
          fontWeight: "600",
        }}
      >
        Upgrade
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default TrialBanner;