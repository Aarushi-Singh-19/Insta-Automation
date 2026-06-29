function PageHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "32px",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              marginTop: "8px",
              color: "#6B7280",
              fontSize: "16px",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

export default PageHeader;