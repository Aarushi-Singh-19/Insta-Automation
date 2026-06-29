import { Plus, CircleUserRound, CreditCard } from "lucide-react";

function QuickActions({ onAutomation, onAccount, onBilling }) {
  const actions = [
    {
      title: "Create Automation",
      icon: <Plus size={20} />,
      onClick: onAutomation,
    },
    {
      title: "Connect Instagram",
      icon: <CircleUserRound size={20} />,
      onClick: onAccount,
    },
    {
      title: "Upgrade Plan",
      icon: <CreditCard size={20} />,
      onClick: onBilling,
    },
  ];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid #E5E7EB",
        padding: "24px",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: "20px",
          color: "#111827",
        }}
      >
        Quick Actions
      </h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={action.onClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#fff",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            {action.icon}
            {action.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;