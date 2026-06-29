function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  style = {},
}) {
  const variants = {
    primary: {
      background: "linear-gradient(135deg,#E1306C,#833AB4)",
      color: "#fff",
      border: "none",
    },

    danger: {
      background: "#EF4444",
      color: "#fff",
      border: "none",
    },

    secondary: {
      background: "#fff",
      color: "#111827",
      border: "1px solid #E5E7EB",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "12px 22px",
        borderRadius: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: "15px",
        transition: "all .2s",
        opacity: disabled ? 0.6 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default Button;