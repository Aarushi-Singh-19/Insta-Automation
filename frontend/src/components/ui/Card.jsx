function Card({
  children,
  style = {},
  onClick,
  hover = false,
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        transition: "all .2s ease",
        cursor: onClick ? "pointer" : "default",
        ...(hover && {
          transform: "translateY(0px)",
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;